# Donkey Sentences and ML Modules

<time datetime="2026-11-05">Date: 2026-11-05</time>

In the field of formal semantics for natural languages,
there is a problem of so-called
<a href="https://en.wikipedia.org/wiki/Donkey_sentence">"donkey sentences"</a>.
Consider how you might translate this sentence into formal logic:

$$
\text{ Any farmer who owns a donkey is rich. }
$$

Intuitively, I would reach for something like:

$$
∀ f ∈ \mathbf{Farmer}. \space
(∃ d ∈ \mathbf{Donkey}. \space \text{OWNS}(f, d)) → \text{RICH}(f)
$$

We assume we have some sets $\mathbf{Farmer}, \mathbf{Donkey}$ and predicates $\text{OWNS}, \text{RICH}$.
But what about this sentence?

$$
\text{ Any farmer who owns a donkey rides it. }
$$

It is tempting to write

$$
∀ f ∈ \mathbf{Farmer}. \space
(∃ d ∈ \mathbf{Donkey}. \space \text{OWNS}(f, d)) → \text{RIDES}(f, d)
$$

but this is meaningless formally, because the variable $d$ is not in scope in $\text{RIDES}(f, d)$.
We need to pull the quantifier out so it scopes over the whole implication.
Knowing that $→$ is contravariant in its left argument,
we might also intuit that the quantifier must be changed from existential to universal:

$$
∀ f ∈ \mathbf{Farmer}. \space ∀ d ∈ \mathbf{Donkey}. \space
\text{OWNS}(f, d) → \text{RIDES}(f, d)
$$

So the problem, in short, is:
how do we assign meaning to the noun phrase "a donkey" in isolation,
if it needs to introduce a quantifier whose scope isn't semantically limited
to the noun phrase itself?

With the disclaimer I don't have formal training in linguistics,
and this might not be a new idea,
some of the existing approaches to this problem bear striking resemblance to how
<a href="https://people.mpi-sws.org/~rossberg/f-ing/">Rossberg, Russo, and Dreyer (2010)</a>
describe the "F-ing" semantics of ML modules.

In the linguistics world, we have
<a href="https://plato.stanford.edu/entries/discourse-representation-theory/">discourse representation theory</a>.
Emphasis mine:

<blockquote class="alt-bg">

A discourse representation structure (DRS) is a mental representation
built up by the hearer as the discourse unfolds.
A DRS consists of two parts: a universe of so-called "discourse referents",
which represent the objects under discussion,
and a set of DRS-conditions which encode the information
that has accumulated on these discourse referents.

An indefinite like "a donkey" is treated not as a quantifier
but simply as device for introducing a discourse referent and one or more conditions;
on the DRT account, **indefinites have no quantifying force of their own.
What quantifying force they seem to have is not theirs,
but derives from the environment in which they occur.**

</blockquote>

If we replace *discourse referents* ↦ *declared type variables* and *conditions* ↦ *declared bindings* (propositions are types!),
this is identical to the notion of a translucent abstract type in the ML modules world.
To quote <a href="http://pithlessly.minx/1ml-intro#abstracted-types">my previous post on this subject</a>:

<blockquote class="alt-bg">

A better mental model of an abstracted type is something like $(\overline{α : κ}. Σ)$ ---
a large type expression that has a number of free variables,
and is equipped with a description of those variables...
but **does not prescribe an interpretation for the variables,
allowing them to later become existentially quantified, universally quantified, or substituted with concrete types**.

</blockquote>

We can even pick out exactly the rule in *F-ing Modules*
that would handle our original example (heavily simplified):

$$
\gdef \rule#1#2#3 {
  \frac{#2}{#3} \quad \text{\htmlClass{smallcaps}{#1}}
}
\newcommand \bblue[1] { \colorbox{ccccff}{$#1$} }
\newcommand \bgreen[1] { \colorbox{ccffcc}{$#1$} }
\gdef \aa {\overline{α}}
\rule{S-funct}{
    \bblue{S_1} \leadsto \bgreen{\aa. Σ}
    \qquad \qquad
    \bgreen{\aa} ⊢ \bblue{S_2} \leadsto \bgreen{Ξ}
}{
    \bblue{S_1 → S_2} \leadsto \bgreen{∀ \aa. (Σ → Ξ)}
}
$$

We can think of the rule as being applied to the sentence as follows:

$$
\gdef \farmer { \textbf{Farmer} }
\gdef \donkey { \textbf{Donkey} }
\newcommand \bblue[1] { \colorbox{ccccff}{#1} }
\newcommand \bgreen[1] { \colorbox{ccffcc}{$#1$} }
\frac{
    \begin{align*}
    & \bblue{farmer … owns a donkey} \leadsto
    \bgreen{f ∈ \farmer, d ∈ \donkey. \space \text{OWNS}(f, d)}
    \\
    & \bgreen{f ∈ \farmer, d ∈ \donkey} ⊢ \bblue{farmer … rides it} \leadsto
    \bgreen{\text{RIDES}(f, d)}
    \end{align*}
}{
    \begin{align*}
    & \bblue{\textbf{Any} farmer \textbf{who} owns a donkey rides it}
    \\
    & \qquad \leadsto \bgreen{ ∀ f ∈ \farmer, d ∈ \donkey. \space (\text{OWNS}(f, d) → \text{RIDES}(f, d)) }
    \end{align*}
}
$$

Okay, this is glossing over a lot of detail here, and I probably have linguists in my audience mad at me.
Natural languages are a lot more complicated than programming languages.
For example, you need machinery for keeping track of how pronouns are bound to existing discourse referents.

Nevertheless, at some level, it's exactly the same logical transformation being made!
The premise contains what looks like an existential quantifier $∃ \overline{α}$,
but it gets pulled out and turned into a universal quantifier $∀ \overline{a}$
in the conclusion.

## What to make of this correspondence?

There is lots of room for cross-pollination between linguistics and PL,
and it would be cool for someone with more background in linguistics than me to explore it.
For example, the SEP article on discourse representation theory I quoted from above
also brings up model theory
as a way of understanding the semantics of discourse.
I've never seen this discussed in the ML modules literature,
and I would love to see how it transfers.

The linguistics and PL perspectives are both valuable when we think about mathematical natural language.
You can't write about module systems without bringing up an abstract algebra example,
so consider this sentence:

> If $x$ is an element of a finite group, then $x$ has finite order.

Although "order" is not a pronoun,
there is still something referential or anaphoric about it---it is only defined
with respect to the specific group structure mentioned.
In most systems of mathematical foundations, including ZFC and type theory (as it is typically done),
the existence of this group structure is a separate hypothesis,
not an inherent part of the type of $x$.
Nonetheless, "the order of $x$" is a perfectly unambiguous concept.
We can explain this by positing that
the noun phrase "a finite group"
introduces the group as a discourse referent
which remains in scope for the consequent part of the sentence.
