# Issues with `instance Ord (STRef s a)`

<time datetime="2025-02-13">Date: 2025-02-13</time>

`STRef` is a Haskell datatype that is used to represent a mutable variable reference.
Purity is maintained by putting two restrictions on their use:

- Read and write operations on the reference live in a monad `ST`.
- The function `runST` that discharges the monad has a type which enforces that
  references created during evaluation of the monad are not accessible after it returns.

`STRef`s have an `Eq` instance, which tests equality of the references.
Occasionally someone will ask why `STRef`s don't have an `Ord` instance that compares by address,
which would allow making a `Set` of `STRefs`.
For example:

- [Stack Overflow](https://stackoverflow.com/questions/23642126/ord-instance-of-stref)
  --- "Is there a good reason that `STRef` is not, or could not be made, an instance of either `Ord` or `Hashable` typeclasses?"
- [Reddit](https://www.reddit.com/r/haskell/comments/15xd1tn/why_stref_doses_not_have_an_ord_instance/)
  --- "Why STRef doses NOT have an Ord instance?"

There are some reasonable answers given in that thread.
For example, since GHC's garbage collector can move objects around,
the address-wise comparison of `STRef`s wouldn't be stable within a call to `runST`.

But the problem is actually worse than that.
Even with an implementation where the garbage collector never moved objects around,
exposing pointer comparison would allow the creation of impure functions:

```hs
f :: () -> Bool
f () = runST (do r1 <- newSTRef 0
                 r2 <- newSTRef 0
                 return (r1 < r2))
```

The comparison could be succeed on the first invocation of `f` and fail on a subsequent one.
