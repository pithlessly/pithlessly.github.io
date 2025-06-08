# Against `do` notation

<time datetime="2023-12-03">Date: 2023-12-03<br/>Last updated: 2023-12-05</time>

Two paradigms for writing effectful code in a language are:

1. Implicit sequencing: an effectful expression producing a result of type `a` can be used in any
   context expecting a value of type `a`, and this is taken to mean that the expression should be
   evaluated --- and its effects performed --- prior to the result being substituted into the
   context.
2. Explicit sequencing: effectful expressions of type `a` are distinguished from pure expressions of
   type `a`, and some explicit step is needed, such as writing `result <- action`, to get a
   usable expression of type `a` in scope. It could also be accomplished with combinators like
   `>>=` and `<*>`.

Typically we associate implicit sequencing with languages that are "lax" about tracking effects in
the type system (impure languages) and explicit sequencing with languages that are more strict about
it (e.g. Haskell and its descendants). But this association isn't universal:
[Koka](https://koka-lang.github.io) is an example of a language with explicit tracking of
effects<sup><a id="footnote-1-link" href="#footnote-1">1</a></sup> but implicit sequencing.

I believe that **implicit sequencing is right** for languages with any kind of type-level effect
tracking, and I'll explain my reasoning.

One important argument for explicit sequencing is referential transparency. If we isolate a pure
fragment of the language, then we can substitute variables bound to pure expressions, i.e. rewriting
`(let x = e1 in e2)` &rarr; `[e1/x]e2` always yields an equivalent program.

Unfortunately, this guarantee comes with caveats. It only holds in a non-strict language, which
excludes even many of Haskell's descendants that feature `do` notation. Even in Haskell, we must be
suspicious of doing the substitution in practice, since floating an expression into or out of a
lambda can vastly change performance characteristics.

Also, as anyone who has worked on large Haskell codebases can attest, in practice almost all code
ends up being written in an effectful context. We might aspire to a "functional core, imperative
shell", but even then, *functional* isn't the same as *not effectful* ---
algebraic<sup><a id="footnote-2-link" href="#footnote-2">2</a></sup> effects can be useful in
expressing the "functional core" of business logic. Once most code resides in some kind of effect,
the weaknesses of explicit sequencing start to show --- for example, the programmer needs to come up
with a lot of names for intermediate expressions, which makes the code less clear since it's hard to
notice that an intermediate variable is only used in one place.

This is also why I take issue with the argument that an advantage of explicit sequencing is that we
can easily visually distinguish pure and "monadic" code. This is only superficially true, since
again, it puts everything from "might be `Nothing`" to "might emit log messages" to "might launch
missiles" into the same monadic box. I think it's a losing battle to try to reflect this kind of
distinction in syntax. Maybe code running in different monads should just be painted different
colors or something.

As the language designer, it feels like any boundary I draw limiting which operations are okay to
allow in the "pure" fragment would be too arbitrary.

- I'm prevented from enriching the language's effect system to track things in the pure fragment.
  Examples of new effects I might wish to track on are:
  - This function is pure, but might make FFI calls.
  - This function is pure, but might allocate and trigger a garbage collection.
  - This function is pure, but an assertion in the standard library might fail.
  - This function is pure, but the generated code relies on certain SIMD instructions, and you have
    an obligation to check that the CPU supports these instructions which can be discharged by
    `check_avx2_support : (unit -> <simd, e> a) -> maybe (unit -> e a)`.

- APIs end up needing pure and effectful variants, e.g. `map` and `mapM`, where the effectful
  variant is technically more general but can't idiomatically be used this way since pure code isn't
  written to live in `Identity`.

- There are some effects which are *almost* pure (e.g. pure modulo some weaker notion of program
  equivalence). It feels strange to relegate all these effects to the realm of explicit sequencing:
  - "Benign" uses of mutability, such as forcing thunks, or path compression in a union-find data
    structure which makes `find` impure despite being logically pure.
  - Effects which are guaranteed to be irrelevant with respect to some phase distinction (e.g. a
    program with debug logging statements inserted is technically impure, but the effects are not
    observable within the program itself).
  - The effect of randomness, where a binding like `(let x = rand() in e)` is referentially
    transparent if `x` is used affinely, up to equivalence of the *probability distribution* of
    program results, even though reordering uses of `rand()` will result in observably different
    behavior if the program is allowed to choose the seed.

In short, as soon as we establish a boundary of "pure", we are tempted to move the boundary upward
to reduce the burden of explicit sequencing, and simultaneously tempted to move the boundary
downward for more precise effect tracking. Better to do away with the connection between explicit
sequencing and effect tracking.

<div id="footnote-1">

1: Koka is actually stricter than Haskell, as it tracks the `div` (divergence)
and `exn` (exception) effects. [&#x21A9;&#xFE0E;](#footnote-1-link)

</div>
<div id="footnote-2">

2: That is, effects defined by operations which we can give an arbitrary handler
for, unlike e.g. `div`. [&#x21A9;&#xFE0E;](#footnote-2-link)

</div>
