<h1>CallCC: a classic operator that defies intuition</h1>

<time datetime="2021-12-16">Date: 2021-12-16<br/>Originally written: 2021-10-01</time>

*Epistemic status: essentially a personal note. Might have any number of misconceptions.*

I've recently been thinking about the "call with current continuation" operator, a rather magical
primitive operation which is included in some functional programming languages, most notably Scheme.
`call-with-current-continuation` can be described as reifying the return operator: it provides a
function with an additional argument, which, when called, will cause the function to immediately
return. For example, these programs are equivalent:

```scheme
(call-with-current-continuation
  (lambda (return)
    (+ 5 5)))

(call-with-current-continuation
  (lambda (return)
    (return (+ 5 5))
    (whatever))) ; this statement will never be evaluated
```

`return` here is called a *continuation* and more conventionally named `k`. Like `return` statements
in imperative languages, execution of the function body stops once it is called. What I noticed is
that this breaks referential transparency, which (broadly) means that the program's results
shouldn't depend on the evaluation strategy. Consider this program:

```scheme
(call-with-current-continuation
  (lambda (k)
    (define var (list (k 1)
                      (k 2)))
    3))
```

What does this return? The answer depends on the order of evaluation:

- If the first call to `k` is evaluated first, the function exits with return value 1.
- If the second call to `k` is evaluated first, the function exits with return value 2.
- If the compiler notices that `var` is never used, and decides not to evaluate it at all, then the
  function returns normally with return value 3. This transformation is generally not permissible in
  languages with side effects, but languages like Haskell do it.

(The actual answer is that it could return either 1 or 2, but not 3. Scheme requires side effects to
be handled but does not specify what order arguments can be evaluated in.)

So having `call-with-current-continuation` (also known as `call/cc`) in the language breaks
referential transparency. As a corollary, it cannot be implemented in a referentially transparent
language. This is why I called it a *primitive operator* rather than simply an ordinary function.
The presence or absence of `call/cc` makes a meaningful difference to a language's semantics which
is worth investigation.

Another thing I was thinking about at the time was an excerpt from an article I read in middle
school. I don't remember the article's content, and most of it went over my head, but a comment that
was somewhat independent from the article's main point stuck with me. To paraphrase:

> Implementing the law of the excluded middle requires writing a term `lem :: Either a (a -> Void)`.
> This can be implemented by first returning `Right` with an opaque function `a -> Void`. There is
> nothing the user could do with this function except pass in a value of type `a` to obtain a
> contradiction. At this point, the runtime has a value of type `a`, and can rewind the computation
> and return `Left a` with the provided value.
>
> _**Edit (2022-09-29):** it may have been [this
> article](https://queuea9.wordpress.com/2018/10/17/why-i-no-longer-believe-in-computational-classical-type-theory),
> although that isn't consistent with the timing._

This idea of "rewinding the computation" seems an awful lot like `call/cc`, doesn't it? In fact, we
can formalize this intuition by "proving" (defining) `lem` and `call/cc` in terms of each other in
Haskell.

```haskell
data Void

lem :: Either a (a -> Void)
lem = callCC (\k -> Right (\a -> k (Left a)))

callCC :: ((a -> Void) -> a) -> a
callCC f = case lem of
  Left (a :: a) -> a
  Right (na :: a -> Void) -> f na
```

Another axiom equivalent to the law of the excluded middle is double negation elimination: the
conversion from a proof that something *cannot be false* to a proof that it *is true*. Double
negation elimination and `call/cc` can be implemented in terms of each other.

```haskell
dne :: ((a -> Void) -> Void) -> a
dne na = callCC (\k -> absurd (na k))
  where absurd (v :: Void) = case v of {} -- from falsehood, anything follows

callCC :: ((a -> Void) -> a) -> a
callCC f = dne (\not_a -> not_a (f not_a))

-- I'm not going to implement `lem` and and `dne` in terms of each other,
-- since it's not quite relevant to this topic and can be derived from the
-- implementations given here.
```

This, to me, indicates a connection between having a `call/cc`-like operation and *proof-relevance*.
Double negation elimination, the LEM, and Pierce's law (which is the analogue of `call/cc` in
classical logic) --- these all seem intuitively correct in classical logic, and the reason is that
we're okay with, for example, proving a disjunction ("either A or B is true") without having an
algorithm that determines which side of the disjunction it is.

The reason these operations seem "weird" when interpreted as programs is that we do care about
proofs --- we expect to be able to "pattern match" and determine which case of a sum type holds.
Introducing `call-cc` as a primitive operator weakens this ability, because we lose agnosticism of
evaluation order: we know `call/cc` returns a value of type `a`, but as the initial examples
demonstrated, the types alone don't tell us enough to know which one exactly.

I suspect that the computational structure of negation is related to the distinction between
propositions and types in many dependently typed proof assistants: propositions are a subset of
types whose proofs cannot be inspected or pattern matched, enabling the language to introduce
classical axioms as propositions without breaking referential transparency.
