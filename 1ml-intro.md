# 1ML for non-specialists: introduction

<time datetime="2023-12-25">Date: 2023-12-25<br/>Last updated: 2025-12-28</time>

_This is the first entry in what I intend as a multi-part series._

1ML is a type system designed by Andreas Rossberg and described in
[a collection of papers](https://people.mpi-sws.org/~rossberg/1ml/) by him.
When it comes to integrating an ML-style module system into a new language,
I think 1ML currently provides the best overall story
(although it's not perfect).

Unfortunately, Rossberg's papers are pretty technical.
He is a good writer, but I feel that right now there is still a communication barrier
between academics who are in a position to discuss 1ML in depth
and people who are in a position to write new compilers.
I see a lot more discussion online that merely _references_ 1ML
than I do discussion that seems to deeply _understand_ it.

I've been studying 1ML for the last several months,
and working on my own prototype implementation
(which unfortunately isn't yet in a publishable state).
In an effort to help these ideas percolate down towards mainstream adoption,
I want to help demystify some things that I found confusing.

This series will not substitute for reading the paper,
but I hope it can be a useful companion.
I'll be working from [the version of the paper published in the Journal of Functional Programming](https://www.cambridge.org/core/journals/journal-of-functional-programming/article/1ml-core-and-modules-united/47B10882829E4B32F98FBA93B28CEF30)
in 2018.
It'll be very helpful to be able to look at that paper as you read this.
In fact, you can press this button to pull it up on the side in this page:
<button onclick="pdf_display();">Open</button>
(It probably doesn't look great on mobile, unfortunately.)

## Prerequisite knowledge

In writing this, I assume the reader:

- Has some familiarity with inference rule notation
  and how type systems are defined using a combination of grammars and inference rules.
- Has some familiarity with the module system of OCaml or Standard ML,
  from a user's perspective (not necessarily knowing their internals).
- Has familiarity with 1ML's design goals as outlined in the
  <a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=1">paper introduction</a>.
- Has _not_ necessarily read the prequel, [F-ing modules](https://people.mpi-sws.org/~rossberg/f-ing/),
  Rossberg's earlier paper on compiling module calculi to F<sub>ω</sub>.

## Goals

By the end of this series of articles,
the reader will have the tools they need
to understand every single inference rule,
including those of the type inference algorithm described in
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=43">Section 7</a>.

I also want to discuss some implementation concerns that are not mentioned in the paper
(such as how to integrate type inference with levels).

## Non-goals

A decent portion of the paper is dedicated to meta-theory
(e.g. the proofs that the type system is sound, etc.).
I have not read these sections in depth, and will not be discussing them here.
It is reasonable for compiler authors to take these results as given
and not focus on their details.

In some places, I will be criticizing the way the paper presents its ideas.
Please do not take these as prescriptions for how it _should have_ been written.
I do not have the standing to make prescriptions like that;
the paper was written with considerations other than the ones most important to me
(such as brevity of the rules, ease of meta-theory, & an intended audience of other academics).

## System F<sub>ω</sub> and the architecture of the type system

At a basic level, 1ML is really just a sophisticated syntactic sugar for
a version of the lambda calculus called
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=18">System F<sub>ω</sub></a>.
If you're not familiar, this is basically the core type system of Haskell,
including higher-kinded type constructors, with all polymorphism being explicit.
1ML terms (I'll use _term_ and _expression_ interchangeably) are converted into F<sub>ω</sub> terms
and 1ML types are converted into F<sub>ω</sub> types.

The specific structure of this translation is best saved for a later article.
For now, I'll say that whenever a type $T$ appears in the surface syntax,
it is immediately converted to a F<sub>ω</sub> type written with the variable $\Xi$.
After this translation, the rules completely forget about $T$ and don't touch it again.
This is why we see similar constructs written with two different syntaxes,
like $\text{(= \textbf{type} $T$)}$ and $[= \tau]$.

This may seem a little unfamiliar; I was used to seeing type systems
that don't distinguish between the surface syntax for types and the internal representation of types.
But of course, a routine like this exists in any real-world type checker,
it's just that many papers would consider it "out of scope" and not discuss it.

<details>

<summary>Technical note: order of record fields</summary>

Whenever a type system defines a class of objects $C$,
it will often come with some invariants ("every $c \in C$ has property $P$")
and some equivalences ("any $c, c' \in C$ are equivalent if $Q$, even if they aren't the same as written").
In situations like this, it is useful to pay attention to which properties and equivalences
are being enforced through the grammar of $C$,
and which are defined using the inference rules.

Unfortunately, when it comes to how F<sub>ω</sub>'s record field labels work,
the paper isn't so clear.
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=18">Fig. 3</a>,
which defines the syntax of F<sub>ω</sub>,
has only this to say:

$$
\tau ::= \dots \mid \{ \overline{ l : \tau } \}
\qquad
e    ::= \dots \mid \{ \overline{ l = e } \}
$$

(See <a href="#overline-notation">below</a> for an explanation of the overline notation.)

However,
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=19">Fig. 4</a>,
which provides typing rules, has this rule for typing field access:

$$
\frac{
    \Gamma \vdash e : \{ l : \tau, \overline{ l' : \tau' } \}
}{
    \Gamma \vdash e.l : \tau
}
$$

This rule only makes sense if we understand record fields to be intrinsically unordered.
I think we can also reasonably assume that $\overline{ l }$
is understood to contain no duplicates.
That resolves our question;
however, for reasons I'll get into later,
I suspect a type checker will want to keep around the original order of field labels in practice.

</details>

I want to linger on
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=19">the type system of F<sub>ω</sub></a>
for a bit longer.
We can think of F<sub>ω</sub> type expressions $\tau$ as terms in a simply-typed lambda calculus
whose base "type" is $\Omega$, the kind of types.
This is the core of what gives F<sub>ω</sub>, and therefore 1ML, its power ---
type checking can invoke some form of computation at the type level.
This power comes with a corresponding burden for the implementer,
who must essentially build an interpreter for
<abbr title="simply-typed lambda calculus">STLC</abbr>
into their type checker.

The key rule is this one:

$$
\frac{
    \Gamma \vdash e : \tau'
    \qquad
    \tau' \equiv \tau
    \qquad
    \Gamma \vdash \tau : \Omega
}{
    \Gamma \vdash e : \tau
}
$$

In words: "whenever an F<sub>ω</sub> term $e$ is considered to have a type $\tau'$,
we could also consider it to have type $\tau$
if $\tau$ is another well-formed type which is _equivalent_ to $\tau'$."

The type equivalence rules are presented as two-directional equalities ($\equiv$),
but in practice, a compiler will want to think of these as one-directional reductions.
You can use a technique like [normalization by evaluation] for this.
Bringing types all the way to normal form whenever you construct them is a viable approach,
but it gets slow for very large types;
there are standard techniques available for being lazier (this is not 1ML-specific).

[normalization by evaluation]: https://en.wikipedia.org/wiki/Normalisation_by_evaluation

## Semantic types and modeling them in code

<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=22">Figure 6</a>
defines the grammar for semantic types. It's important, so I'll reproduce it here.

$$
\begin{align*}
\text{(abstracted)} \quad && \Xi    \quad & ::= \quad \exists \overline\alpha. \Sigma
\\
\text{(large)}      \quad && \Sigma \quad & ::= \quad \pi \mid \text{bool} \mid [= \Xi] \mid \{ \overline{ l : \Sigma } \} \mid \forall \overline\alpha. \Sigma \to_\eta \Xi
\\
\text{(small)}      \quad && \sigma \quad & ::= \quad \pi \mid \text{bool} \mid [= \sigma] \mid \{ \overline{ l : \sigma } \} \mid \sigma \to_{\texttt{I}} \sigma
\\
\text{(paths)}      \quad && \pi    \quad & ::= \quad \alpha \mid \pi \overline\sigma
\\
\text{(purity)}     \quad && \eta   \quad & ::= \quad \texttt{P} \mid \texttt{I}
\end{align*}
$$

<details id="overline-notation">

<summary>Note: the meaning of overline notation, as in $\overline{l : \Sigma}$</summary>

This is meta-theoretic syntax that just means "zero or more"
(sometimes including delimiting commas).
For those familiar with Rust's macro system,
it is comparable to something like `{ $($l:label : $sigma:large_typ),* }`.

</details>


### Large and small semantic types

The first thing we should observe is that large and small types aren't really defining a new grammar,
but instead a *subgrammar* of F<sub>ω</sub> types
(so we have $\{ \sigma \} \subseteq \{ \Sigma \} \subseteq \{ \Xi \} \subseteq \{ \tau \}$).
This is why the metavariable $\tau$ doesn't appear much in the rest of the paper from now on ---
most of the F<sub>ω</sub> stuff going on will be restricted to semantic types.

The only wrinkle is the new type formers:
the singleton $[= \Xi]$ and the function type with a purity annotation $\Sigma \to_\eta \Xi$.
The paper defines these via desugaring to F<sub>ω</sub> types with single-field records,
but an implementation will find it easier to treat them as their own type constructors.

### Paths

The path grammar is a little wonky. It allows repetition of $\sigma$ in two different ways,
suggesting that a path is an F<sub>ω</sub> type variable applied to a _list of lists_ of small types,
like $\pi ::= \alpha \overline{\overline\sigma}$.
My guess is that this is just a mistake;
it suggests that paths have structure beyond the F<sub>ω</sub> types of which they are supposed to be a subgrammar,
and nothing in the rest of the paper goes wrong if we just treat it as $\pi ::= \alpha \overline\sigma$.

I honestly find the whole idea of a path a little poorly motivated.
My best attempt to articulate the role paths play in the rest of the paper
is that they enforce that a semantic type is (roughly) in normal form
(since type-level function applications always have a variable at their head),
and that only small types can be applied as arguments to functions.
"Path" is really a misnomer from this perspective.
(The fact that a set of paths is an input to the subtyping relation
$\Gamma \vdash \Sigma' \leq_{\overline\pi} \Sigma$ is actually a red herring,
as I'll discuss in a later article.)

### Abstracted types

**The abstracted type grammar $\Xi ::= \exists \overline\alpha. \Sigma$
risks giving the reader poor intuitions.**<sup><a id="footnote-1-link" href="#footnote-1">1</a></sup>
You should think of "abstracted types" as corresponding to signatures (a.k.a. module types)
in traditional descriptions of ML.
They can contain one or more abstract types (the $\overline\alpha$),
but thinking of them as existentially quantified is too limiting,
since they can be specialized to concrete types after the fact
by constructs like `T where type t = bool`.

As an illustration of this, you can look at the desugaring rules
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=25">on page 25</a>,
which say that the surface signature `{ type t; x : t }` gets desugared
to $\Xi = \exists \alpha : \Omega. \{ t : [= \alpha], x : \alpha \}$.
This is an F<sub>ω</sub> type which is _provably useless_!<sup><a id="footnote-2-link" href="#footnote-2">2</a></sup>
But this signature isn't useless --- we could readily imagine a functor in OCaml having it as an argument.

In my opinion, writing $\exists$ here is an abuse of notation.
A better mental model of an abstracted type is something like $(\overline{\alpha : \kappa}. \Sigma)$ ---
a large type expression that has a number of free variables,
and is equipped with a description of those variables (their kinds),
but does not prescribe an interpretation for the variables,
allowing them to later become existentially quantified, universally quantified, or substituted with concrete types.
This is what the paper calls
<a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=11">translucency</a>;
if you're familiar with nominal sets, you can also think of it as a binder.

### A summary of my implementation recommendations

- Don't create a separate data type for F<sub>ω</sub> types $\tau$;
  instead, create a data type that represents large types $\Sigma$.

- Contexts $\Gamma$ contain large types.

- Don't have a separate data type for small types; it will result in too much code duplication.
  Instead, smallness should be an invariant not tracked by the type system.

- Do create a separate data type for $\Xi$, along the lines of:
  ```ocaml
  type signat = (type_variable * kind) list * large_type
  ```

- Introduce a dedicated constructor for $[= \Xi]$ in your large type ADT.

- Either have a dedicated constructor for $\forall \overline\alpha. \Sigma \to_\eta \Xi$,
  or separate it out based on $\eta$ to model
  <a class="paper-link" href="1ml-common/1ml-jfp-official.pdf#page=24">the syntactic invariant</a>
  for pure functions
  ($\forall \overline\alpha. \Sigma \to_{\texttt{I}} \Xi$ and
  $\forall \overline\alpha. \Sigma \to_{\texttt{P}} \Sigma$).

## Wrapping up

That's all I have time for today.
In the next entry, I'll cover the surface syntax of 1ML,
the desugaring judgement $\Gamma \vdash T \leadsto \Xi$,
the role of the $[= \Xi]$ type,
and how I think about phase separation.

## Footnotes

<div id="footnote-1" class="highlightable">

1: The use of this notation goes at least back to F-ing modules,
so there is at least precedent for it,
and it makes the rules more concise to not have to coerce from $\Xi$ to a "real" existential type,
but I still don't like it.
[&#x21A9;&#xFE0E;](#footnote-1-link)

</div>
<div id="footnote-2" class="highlightable">

2: This type is isomorphic to $A := \exists \alpha. \alpha$,
a type whose values cannot be distinguished in any way ---
there's no way to write a function $A \to \textbf{bool}$ that isn't constant.
[&#x21A9;&#xFE0E;](#footnote-2-link)

</div>

<script src="1ml-common/pdf_display.js"></script>
