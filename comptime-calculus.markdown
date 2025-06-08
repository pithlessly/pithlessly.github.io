# The comptime calculus

<time datetime="2025-06-03">Date: 2025-06-03</time>

This is an attempt at formalizing some aspects of Zig's comptime.
We have three types of binders:

- Ordinary lambda binders ($\lambda$) can capture variables and be applied arbitrarily, but are not dependent.
  They correspond to a function like `fn f(x: A) B {}`.
- Static lambda binders ($\lambda_s$) cannot capture variables.
  They correspond to a function like `fn f(comptime x: A) B {}`,
  where `x` is not free in `B`.
  Their argument must be provided at compile time, and type checking
  the body is deferred until they are called.
- Generic lambda binders ($\Lambda_s$) cannot capture variables.
  They correspond to a function like `fn f(comptime x: A) B(x) {}`.
  Their argument must be provided at compile time, and the type checking
  of both the body *and* the return type is deferred until they are called.

Conventions:
- Uppercase Latin letters range over terms.
- Lowercase Latin letters range over values (a subset of terms).
- Except $x$, which ranges over variables.
- $\Gamma$ ranges over contexts (which map names to types).
- $*$ is a particular value.
- All types of lambda binders are expressions.
  Binders are annotated with their argument and return types,
  which we sometimes omit for brevity.

We will be simultaneously defining two relations:

$$
\begin{aligned}
  \boxed{ \Gamma \vdash M : a } & \qquad \text{ $M$ has type $a$ in $\Gamma$ }
  \\
  \boxed{ M \leadsto z : a } & \qquad \text{ $M$ evaluates to $z$ at type $a$ }
\end{aligned}
$$

We only evaluate closed terms.

$$
\begin{aligned}
    \boxed{\text{ Eval-Val }}
    & \qquad
    \frac{
        \cdot \vdash z : a
    }{
        z \leadsto z : a
    }
\\\\
    \boxed{\text{ Ty-$\lambda$ }}
    & \qquad
    \frac{
        A \leadsto a : *
        \qquad
        B \leadsto b : *
        \qquad
        \Gamma, x : a \vdash E : b
    }{
        \Gamma \vdash (\lambda (x : A) \to E : B) : a \to b
    }
\\\\
    \boxed{\text{ Ty-App-$\lambda$ }}
    & \qquad
    \frac{
        \Gamma \vdash E_1 : a \to b
        \qquad
        \Gamma \vdash E_2 : a
    }{
        \Gamma \vdash E_1(E_2) : b
    }
\\\\
    \boxed{\text{ Eval-App-$\lambda$ }}
    & \qquad
    \frac{
        E_1 \leadsto (\lambda x \to E') : a \to b
        \qquad
        E_2 \leadsto v_2 : a
        \qquad
        [v_2 / x]E' \leadsto v' : b
    }{
        E_1(E_2) \leadsto v' : b
    }
\\\\
    \boxed{\text{ Ty-$\lambda_s$ }}
    & \qquad
    \frac{
        A \leadsto a : *
        \qquad
        B \leadsto b : *
    }{
        \cdot \vdash (\lambda_s (x : A) \to E : B) : a \to_s b
    }
\\\\
    \boxed{\text{ Ty-App-$\lambda_s$ }}
    & \qquad
    \frac{
        E_1 \leadsto (\lambda_s x \to E') : a \to_s b
        \qquad
        E_2 \leadsto v_2 : a
        \qquad
        \cdot \vdash [v_2/x] E' : b
    }{
        \cdot \vdash E_1(E_2) : b
    }
\\\\
    \boxed{\text{ Eval-App-$\lambda_s$ }}
    & \qquad
    \frac{
        E_1 \leadsto (\lambda_s x \to E') : a \to_s b
        \qquad
        E_2 \leadsto v_2 : a
        \qquad
        [v_2/x] E' \leadsto v' : b
    }{
        E_1(E_2) \leadsto v' : b
    }
\\\\
    \boxed{\text{ Ty-$\Lambda_s$ }}
    & \qquad
    \frac{
        A \leadsto a : *
    }{
        \Gamma \vdash (\Lambda_s (x : A) \to E : B) : \forall (x : a) \to_s B
    }
\\\\
    \boxed{\text{ Ty-App-$\Lambda_s$ }}
    & \qquad
    \frac{
        E_1 \leadsto (\Lambda_s x \to E') : \forall (x : a) \to_s B
        \qquad
        E_2 \leadsto v_2 : a
        \qquad
        [v_2/x] B \leadsto b : *
        \qquad
        \cdot \vdash [v_2/x] E' : b
    }{
        \cdot \vdash E_1(E_2) : b
    }
\\\\
    \boxed{\text{ Eval-App-$\Lambda_s$ }}
    & \qquad
    \frac{
        E_1 \leadsto (\Lambda_s x \to E') : \forall (x : a) \to_s B
        \qquad
        E_2 \leadsto v_2 : a
        \qquad
        [v_2/x] E' \leadsto v' : b
    }{
        E_1(E_2) \leadsto v' : b
    }
\end{aligned}
$$

Note the general trend: as we move from $\lambda$ to
$\lambda_s$ to $\Lambda_s$,
we gradually move more of the premises from $\text{Ty-Foo}$
to $\text{Ty-App-Foo}$.
