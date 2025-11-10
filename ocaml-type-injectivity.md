# Newtypes vs. abstract types, and the limitations of type inference

<time datetime="2025-11-09">Date: 2025-11-09</time>

<strong>TL;DR:</strong>
In OCaml, making a module's type more specific can sometimes break your module's users,
because of a technicality of type inference: abstract type constructors are assumed injective.
If you ever design a type system, injectivity is something you should be keeping in mind.
It also illustrates some broader issues around how we think about backwards compatibility.

I first came across this issue while studying the type inference algorithm for Rossberg's
[1ML]<sup><a id="footnote-1-link" href="#footnote-1">1</a></sup>,
and I think it's worth contributing to the conversation about abstract types ---
maybe it's well known in OCaml circles, but I hadn't come across it personally.

## Background

You can skip this section if you already know OCaml.

I've recently spent a lot of time trying to understand the details of
how to type check ML-style modules,
especially first class modules à la 1ML.
One of the big ideas of ML-style module systems is the idea of an _abstract type_:
a type whose name is exported by a module, but not its definition.

[1ML]: https://people.mpi-sws.org/~rossberg/1ml/

Abstract types get us some of the benefits of Haskell-style [newtypes],
but without the defining module having to repeatedly wrap and unwrap the constructor.
In this example,
the module `Length` has an abstract type `length`.
Privately, `length` is equivalent to `float`, but publicly, this fact isn't revealed:

[newtypes]: https://wiki.haskell.org/index.php?title=Newtype

```ocaml
module Length : sig

  type length

  val from_cm : float -> length
  val from_in : float -> length
  val add     : length -> length -> length

end = struct

  type length = float (* represented in cm *)

  let from_cm x = x
  let from_in x = x *. 2.54
  let add a b = a +. b

end

let foot  : Length.length = Length.from_in 12.0 (* ok *)
let meter : Length.length = 100.0 (* type error: Length.length ≠ float *)
```

On the other hand, a newtype<sup><a id="footnote-2-link" href="#footnote-2">2</a></sup>
is distinct from the outset:

```ocaml
type length =
  | Length of float

let from_cm x = Length x
let from_in x = Length (x *. 2.54)
let add (Length x) (Length y) = Length (x +. y)
```

There has been a lot of prior conversation about the merits of newtypes and abstract types ---
I specifically have in mind @welltypedwitch's
["Newtypes Are Better Than Abstract Type Synonyms"][better] (2024), for example.
What's important is that OCaml supports both,
and indeed from an implementation perspective
they really aren't that different.
In both cases, we have a type `length` in scope,
and it's assumed to be distinct from every other named type
(`float`, `'a list`, etc.).
The only difference is that with newtypes
we happen to also know about an associated constructor
`Length : float -> length`.

[better]: https://welltypedwit.ch/posts/newtypes.html

## A closer look

Conceptually, are these two situations really as similar as they seem?

- In the second case, the inequality `float` ≠ `length` is known _definitively_,
  since `length` is a fresh type that we just created.
- OTOH, the abstract type `Length.length` in the first case isn't
  _definitively_ distinct from `float`.
  It's maybe more accurate to say that the type checker is forbidding us
  from seeing the real definition of this abstract type.

By refining the signature of `Length`,
we could have instead made this definition public:

```ocaml
module Length : sig

  type length = float
  (* ... *)

end = struct (* ... *) end
```

Now the equation `Length.length = float` is exposed to the consumer of the module:

```ocaml
let meter : Length.length = 100.0 (* accepted *)
```

Hopefully this isn't too surprising;
it's exactly how subtyping is supposed to work:

- we changed the type of a module to make it more specific
- existing code that used it kept working
- some code that used to be rejected is now also accepted

Unfortunately, by taking advantage of this exact behavior for an abstract type *constructor*,
we can exhibit the opposite behavior:
code that used to work can break upon refining a module to a subtype.

## The nasty example

Let's start by creating a new type `adt` with a data constructor `Foo`.

```ocaml
module A = struct
  type adt =
    Foo
end
```

Here, `adt` isn't an abstract type:
it and its constructor are publicly accessible,
but they aren't in scope, since they're inside the module `A`.

Next, we create a module with an abstract type constructor `con`.
(Type constructors are applied postfix in OCaml.)
Inside the module, `con` is actually defined to be a constant type function,
equal to `string` for all input types,
but we don't reveal this fact to the outside.
We also define a polymorphic function `f`
which takes a dummy tuple argument of type `'a con * 'a`.

```ocaml
module B : sig

  type       'a con (* = string *)
  val x : A.adt con
  val f :    'a con * 'a -> unit

end = struct

  type 'a con = string
  let x   = "awa"
  let f _ = ()

end

let _ = B.f (B.x, Foo)
```

Let's walk through how OCaml type checks the expression `B.f (B.x, Foo)`
in excruciating detail.

- We start with no particular assumptions on what type we should expect to find.

- The first thing we encounter is an application of the polymorphic function `B.f`.
  Since `'a` is a generic type, we can't know immediately what it will be,
  so we treat it as an unsolved variable <code><b>u</b></code>.
  Then the type of the function becomes:

  <code><b>u</b> B.con * <b>u</b> -> unit</code>.

  This is enough to conclude that the result type of this function application is `unit`,
  and that we should expect the argument expression to be a value of type
  <code><b>u</b> B.con * <b>u</b></code>.
  So we recursively proceed into the argument expression.

  - We are now checking the expression `(B.x, Foo)`, with the expected
    type <code><b>u</b> B.con * <b>u</b></code>.
    We recursively descend into the tuple's compnents in order:

    1. Visiting the first component `B.x`,
       we expect to find a value of type <code><b>u</b> B.con</code>,
       and in fact find a variable of type `A.adt B.con`.

       Since `B.con` is an abstract type that we know nothing about,
       the only way we can satisfy this equation is if we set
       <code><b>u</b></code> = `A.adt`.

    2. Visiting the second component `Foo`,
       we expect to find a value of type <code><b>u</b></code>.
       Having solved for this variable,
       we now know that we're looking for a value of type `A.adt`.

       What do we do with the data constructor?
       Normally, we would try to find it in scope, which would fail.
       But since we came expecting the concrete type `A.adt`,
       it's only possible for `Foo` to be a constructor of that type.
       Sure enough, by looking up the publicly accessible definition of `A.adt`,
       we find a constructor with the appropriate name.
       <sup><a id="footnote-3-link" href="#footnote-3">3</a></sup>

<br>

Can you spot the problem?

It's our assumption that if <code><b>u</b> B.con</code> = `A.adt B.con`
then <code><b>u</b></code> = `A.adt`.
That is, we assumed `B.con` was _injective_.
Suppose we had exposed the definition of `'a con` in `B`:

```ocaml
module B : sig

  type       'a con = string
  val x : A.adt con
  val f :    'a con * 'a -> unit

end = (* ... *)
```

Since the type equality is now exposed,
this type signature is treated exactly the same as
if we had expanded the definition of `'a con` elsewhere:

```ocaml
module B : sig

  type 'a con = string
  val x : string
  val f : string * 'a -> unit

end = (* ... *)

let _ = B.f (B.x, Foo)
```

This time, visiting the first component of the tuple doesn't help us solve for
<code><b>u</b></code>.
So when we visit the second component `Foo`, we don't have any way of figuring
out what ADT this is supposed to be a constructor for, and type inference fails.

This is despite the fact that the only change we made was to provide
users of the module `B` with _more_ information!

## What kind of problem is this?

When you boil it down, the fundamental issue is that OCaml's type inferencer
makes the necessary compromise of assuming that an abstract type constructor
can be treated as injective.<sup><a id="footnote-4-link" href="#footnote-4">4</a></sup>
When we then instantiated this abstract type with a non-injective definition
(`type 'a con = string`),
we relaxed constraints that the inferencer had previously been using to deduce type information.

However, the compiler is smart enough to understand that
it can only make this assumption to figure out an unknown type,
and not when correctness would be at stake.
(Apparently, soundness issues around abstract type injectivity [have come up before],
and were fixed.)

[have come up before]: https://ocaml.org/conferences/ocaml/2013/proposals/injectivity.pdf

So this isn't an issue of soundness and arguably not really even one of completeness either.
Rather, it's a failure of _stability of subtyping_,
which we might describe using a rule like:

$$
\frac{
  x : A \vdash e : B
  \qquad
  A' \le A
}{
  x : A' \vdash e : B
}
$$

Read: "if the expression $e$ can be assigned the type $B$
when the free variable $x$ is assumed to have type $A$,
then it can also be assigned the same type
when $x$ is assumed to have the more specific type
$A' \le A$."
(In fact, it might be possible to also assign $e$ a more specific type
with this stronger assumption, but we can ignore that.)

Note though that this failure isn't present in the explicitly typed version of the calculus,
but only manifests once type inference enters the picture.
I think this is another illustration that
[The Way We're Thinking About Breaking Changes is Silly][breaking changes],
especially with regards to features like type inference and type-directed name resolution.
These features exist so that the programmer can omit certain details,
trusting the compiler to reconstruct them based on the information it has available.
Backwards incompatibilities arise when dependencies change
and suddenly the compiler has too _much_ information
to uniquely reconstruct the programmer's intent.
But this is only really a problem because we've decided that
we should be throwing away this rich information after every compilation and starting fresh!

[breaking changes]: https://welltypedwitch.bearblog.dev/the-way-were-thinking-about-breaking-changes-is-really-silly/

## Takeaways

As I said, I think this flaw is the result of a reasonable compromise.
It's telling that OCaml, Standard ML, and 1ML all have it in some form.
Requiring the introduction of a newtype for every type-level function, as Haskell does,
is probably a bigger flaw than having another way to violate stability of subtyping ---
especially considering that it can be violated in other ways, such as shadowing with `include`.

Another potential solution could be to extend the type language to track whether
a type constructor is known to be injective.
While OCaml does do this internally,
I think the annotation system would have to become more complex with higher kinds.

My ideal solution would be enriching the kind of information we store along with source code
in such a way that violations of stability of subtyping at the source level
don't cause problems with library-level backwards compatibility.
Suppose program $A$ depends on a library of type $B$,
which gets updated to a new version of type $B' ≤ B$.
It would be nice if the compiler could keep records of how it type checked $A$ under $B$
and use these to repair the source code in order to keep $A$ working.

<br>

## Notes

<div id="footnote-1" class="highlightable">

1: The specific culprit in 1ML is the rule <span class="smallcaps">IUpath</span>,
which handles unification of "paths" (a type variable applied to a sequence of arguments).
I haven't studied the OCaml type checker in detail, but it likely has a similar rule.
[&#x21A9;&#xFE0E;](#footnote-1-link)

</div>
<div id="footnote-2" class="highlightable">

2: Technically, for this to really qualify as a newtype,
we would want a guarantee that this new type
has the same runtime representation as `float`.
I'll ignore this detail here because I'm just focused on the type checking side of things.
[&#x21A9;&#xFE0E;](#footnote-2-link)

</div>
<div id="footnote-3" class="highlightable">

3: This behavior, where we have type-directed name resolution for ADT constructors,
might be unfamiliar to Haskell/Rust users.
It feels a bit weird,
but it's precisely the dual of record field access syntax `r.x` ---
we look up the name `x` in the type of `r` rather than looking in scope.
[&#x21A9;&#xFE0E;](#footnote-3-link)

</div>
<div id="footnote-4" class="highlightable">

4: In fact, although I've framed it in the context of OCaml modules,
this problem isn't specific to this setting.
A naïve attempt to implement type inference for [System F<sub>ω</sub>][Fw]
(the underlying "core" calculus of languages like Haskell and ML)
would run into similar problems with a type like

[Fw]: https://en.wikipedia.org/wiki/System_F#System_F%CF%89

$$
\forall (\beta : \star \to \star). \enspace
(\forall (\alpha : \star). \enspace \alpha \to \beta(\alpha))
  \to \dots
$$

that quantified over an abstract type constructor.

Haskell gets around this issue by not having type-level lambda, so that
a kind like $\star \to \star$ contains only partially applied type constructors.
This means that the assumption of injectivity is actually OK,
but results in even more pervasive use of newtypes,
and means type aliases and type families aren't first-class citizens.
See ["Injective Type Families for Haskell" (2015)][inj15] for more discussion.
[&#x21A9;&#xFE0E;](#footnote-4-link)

[inj15]: https://repository.brynmawr.edu/cgi/viewcontent.cgi?article=1003&context=compsci_pubs

</div>
