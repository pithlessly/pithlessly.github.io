# Intensional Joy (a concatenative account of internal structure)

<time datetime="2025-02-11">Date: 2025-02-11</time>

*Intensional* programming languages (no, I didn't say *intentional*)
have had a bit of a moment in the spotlight recently.
Specifically, back in December,
Johannes Bader's website on [tree calculus](https://treecalcul.us)
popularized some work on intensional rewriting systems
which was largely spearheaded by Dr. Barry Jay.
These are systems that resemble [combinatory calculi](https://en.wikipedia.org/wiki/Combinatory_logic#Combinatory_calculi) like SKI,
but have the ability to treat functions as more than just black boxes ---
you can look inside a function to see the code that defines it and do things with that.

Dr. Jay and collaborators have developed a number of variants
--- SF calculus, tree calculus, triage calculus, etc. ---
but they embody this same core idea for my purposes.

Today I want to take the idea of intensional programming and try to transfer the ideas from
combinators to a different domain: [concatenative programming](https://en.wikipedia.org/wiki/Concatenative_programming_language).
I have further thoughts about tree calculus, but they're best left for another post.

### About the name

In philosophy, when we describe a thing,
we take an *extensional* view when we care only about the thing being described
and an *intensional* view when we care about the way it was described.
By analogy in programming we say that
the extensional view of a piece of code encompasses only its I/O behavior
and the intensional view encompasses its implementation details.
So mergesort and (stable) heapsort are the same extensionally but different intensionally.

## Brief introduction to Joy

[Joy](https://en.wikipedia.org/wiki/Joy_(programming_language))
is a language which tries to capture the essence of concatenative programming.
I'll use a simplified version here which can be presented as a
stack-based language or a system of rewriting rules.

Joy's syntax is as follows: a program consists of zero or more *commands*,
and a command is either a program wrapped in square brackets (a *quotation*)
or one of {`dup`, `swap`, `pop`, `cat`, `quote`, `eval`} (the *operators*).

### Stack-based semantics

A Joy program executes on a stack which contains programs.
Each command has a certain behavior when executed:

- Executing a quotation `[p]` pushes `p` to the stack.
- `dup` duplicates the top element of the stack.
- `swap` swaps the top two elements of the stack.
- `pop` removes the top element of the stack.
- `cat` takes two elements off the stack and concatenates them,
  with the topmost element coming second.
- `quote` takes the top element `p` off the stack and pushes `[p]`
  (a single-command program consisting of a quotation).
- `eval` takes the top program off the stack and executes it.

So for example the Joy program
`[dup dup dup] [[pop pop]] swap quote cat eval dup cat`
results in a stack containing the two programs
`pop pop` and `dup dup dup dup dup dup`.

### Rewriting semantics

I'll denote the rewriting relation by <math>\to</math>
and use <math>a, b, c</math> to range over arbitrary programs.

The execution of a Joy program can then be described by a sequence of rewrites:

<math>
\begin{aligned}
       [a] \, \text{dup}   &\to [a] \, [a] \\
[a] \, [b] \, \text{swap}  &\to [b] \, [a] \\
       [a] \, \text{pop}   &\to \epsilon \\
[a] \, [b] \, \text{cat}   &\to [a b] \\
       [a] \, \text{quote} &\to [[a]] \\
       [a] \, \text{eval}  &\to a \\
\end{aligned}
</math>

If we always apply the leftmost rewrite which is not inside a quotation,
then we get a notion of "applicative order reduction"
which simulates the stack-based semantics.
(Think of the sequence of quotations coming before the leftmost operator as representing the stack.)

The code example I gave about reduces as follows (redexes in blue):

<math>
\begin{aligned}
        & \space \colorbox{#ccccff}{$ [\text{dup dup dup}] \space [[\text{pop pop}]] \text{ swap} $} \text{ quote cat eval dup cat}
\\  \to & \space [[\text{pop pop}]] \space \colorbox{#ccccff}{$ [\text{dup dup dup}] \text{ quote} $} \text{ cat eval dup cat}
\\  \to & \space \colorbox{#ccccff}{$ [[\text{pop pop}]] \space [[\text{dup dup dup}]] \text{ cat} $} \text{ eval dup cat}
\\  \to & \space \colorbox{#ccccff}{$ [[\text{pop pop}] \space [\text{dup dup dup}]] \text{ eval} $} \text{ dup cat}
\\  \to & \space [\text{pop pop}] \space \colorbox{#ccccff}{$ [\text{dup dup dup}] \text{ dup} $} \text{ cat}
\\  \to & \space [\text{pop pop}] \space \colorbox{#ccccff}{$ [\text{dup dup dup}] \space [\text{dup dup dup}] \text{ cat} $}
\\  \to & \space [\text{pop pop}] \space [\text{dup dup dup dup dup dup}]
\end{aligned}
</math>

## Making Joy intensional with one operator

Joy is extensional --- it has no way to "take apart" a quotation into its consituent parts.
The only way to inspect a program given on the stack is to `eval` it,
which only tells us about the extensional behavior of that program,
not its intensional properties.

Is there a single primitive we can add to Joy which gives it the ability to introspect programs?

My friend [@olus2000](https://olus2000.pl/) described an intensional operator `map`:

> `A B C map` would map over every element of A applying B if it's a primitive [i.e. operator] or C if it's a quotation

This can be described in the rewriting semantics as follows:

<math>
\begin{aligned}
        [] \, [b] \, [c] \, \text{map} &\to \epsilon \\
[[p] \, a] \, [b] \, [c] \, \text{map} &\to [p] \, c \, [a] \, [b] \, [c] \, \text{map} \\
  [o \, a] \, [b] \, [c] \, \text{map} &\to [o] \, b \, [a] \, [b] \, [c] \, \text{map} & \text{if $o$ is an operator} \\
\end{aligned}
</math>

I want to describe another operator, which is simpler but more unwieldy.
Named `quota`, its behavior is to pop a single program from the stack and
surround every command in that program (including quotations) in a quotation.
For example, `[quote [dup eval] cat] quota` creates the program
`[quote] [[dup eval]] [cat]` on the stack.

The rewriting semantics are a little annoying, but can be expressed with a similar recursive rule:

<math>
\begin{aligned}
      [] \, \text{quota} &\to [] \\
[c \, a] \, \text{quota} &\to [[c]] \, [a] \text{ quota cat} &\text{if $c$ is a command}
\end{aligned}
</math>

(Recall that the difference between commands and operators is that quotations are commands.)

### Equivalence of `map` and `quota`

I want to show that these two intensional operators can be expressed in terms of each other.
The reduction `quota` → `map` (that is, expressing `quota` in terms of `map`)
is not very complicated, so I'll focus on the more interesting side:
expressing `map` in terms of `quota`.

Suppose we have a quoted command <math>[c]</math> on the stack.
To emulate the behavior of `map`, we need to detect whether it's a quotation.

With the sole exception of `dup`,
every operator we've introduced so far have the following two properties:

- They take at most three arguments;
- If their arguments are all empty, then their execution either
  shrinks the stack or keeps it the same size.

Quotations and `dup` are the only commands which grow the stack in this scenario.
Imagine a program which looks like this:

<math>
[X_1] \, [\text{eval}] \, [\text{eval}] \, [\text{eval}] \, [X_2] \, [] \, [] \, [] \, [c] \text{ eval pop pop pop pop eval}
</math>

If <math>c</math> transforms the three empty quotations into three or fewer stack elements,
then the `pop` commands will remove all of these elements, as well as the <math>[X_2]</math> quotation,
and we will be left with just <math>[X_1]</math> and zero or more <math>[\text{eval}]</math> quotations.
The final use of `eval` will start a daisy-chain that ultimately reduces the whole expression to just <math>X_1</math>.

On the other hand, if <math>c</math> creates an additional element on the stack,
then the expression will reduce like:

<math>
\begin{aligned}
         & \space [X_1] \, [\text{eval}] \, [\text{eval}] \, [\text{eval}] \, [X_2] \, [] \, [] \, [] \, [c] \text{ eval pop pop pop pop eval}
\\ \to^* & \space [X_1] \, [\text{eval}] \, [\text{eval}] \, [\text{eval}] \, [X_2] \, [] \, [] \, [] \, [\dots] \text{ pop pop pop pop eval}
\\ \to^* & \space [X_1] \, [\text{eval}] \, [\text{eval}] \, [\text{eval}] \, [X_2] \text{ eval}
\\ \to   & \space [X_1] \, [\text{eval}] \, [\text{eval}] \, [\text{eval}] \, X_2
\end{aligned}
</math>

Thus this snippet effectively discriminates between two sets of commands:
`dup` and quotations (for which <math>X_2</math> will run)
and everything else (for which <math>X_1</math> will run).

Believe it or not, we're now almost done:
if we can find a way to distinguish `dup` from a quotation,
we'll have everything we need to implement `map`.

Putting together the implementation is just an exercise in Joy programming ---
the only tricky bit is that `quota` creates a subprogram which pushes a lot of stuff
to the stack, and we need to be able to write a loop which iterates over all this stuff.
Knowing when to *stop* the loop requires we put a "flag" on the stack
which is clearly distinguishable from any command.
One simple choice is a program that pushes two elements, like <math>[] \\, []</math>.
If we do this, we need to modify the above template program to also handle this third case and
ensure iteration of the loop is stopped.

### Distinguishing `dup` from a quotation

When I originally realized the problem of needing to distinguish `dup` from a quotation
in subprogram <math>X_2</math>,
I actually wondered if it was impossible.
The problem here is that both of these commands will push a single element <math>c_2</math> to the stack
but we are limited in our ability to actually analyze this element.
We can't `eval` it, since it could be an arbitrary subprogram.
And precisely because it is arbitrary, it doesn't seem like there is anything
we can do to reliably distinguish it from the program that would be created by `dup`.

Thinking about it more, though, it turns out that it actually *is* possible
if we allow ourselves more invocations of `quota` --- this time to introspect <math>c_2</math>.

The result of `quota` will be a subprogram consisting of some number of quotations,
each of which consists of a single command.

We can once again use standard Joy programming techniques to count the number of these quotations.
This time, we don't need to distinguish any of the commands from each other;
we just need to be able to identify some the stop condition.
So we end up with a snippet similar to one from the last section, but a little simpler.

This gives us a decidable way to count the number of commands in any program.
This is what finally lets us figure out <math>c</math>:
if <math>c</math> is a quotation <math>c = [c_2]</math> then
every time we count the number of commands in <math>c_2</math>, the result will be the same.
OTOH, if <math>c = \text{dup}</math> then
we can run <math>c</math> with an empty program atop the stack, and we will observe that
this results in the length of <math>c_2</math> being zero.
Then if we run <math>c</math> again with <math>[]</math> atop the stack, we will instead observe
that the length of <math>c_2</math> is <math>1</math>.

In other words, we don't recognize a quotation by any particular output,
but by the way the output length is *dependent* on the contents of the stack.

## Conclusions

I've now presented two different operators for intensional programming in a concatenative language,
`map` and `quota`.
`quota` is incredibly simple to describe, but a bit more complicated to use,
whereas `map` is easy to use, but is arguably more complex since it subsumes the behavior
of other operators (namely, it is capable of evaluating quotations,
making it a bit redundant with `eval`).

Nevertheless, we've shown that each of these operators can have its behavior
captured by the other.
Normally I would say unequivocally that this makes these operators equivalent.
However, in an intensional setting, equivalence is more complicated ---
`map` may be equivalent in *behavior* to an subprogram defined in terms of `quota`,
but an intensional program would still be able to distinguish that
the former is a single operator and the latter is a subprogram with multiple commands.
I think that it would be valuable for future researchers to come up with a weaker general
notion of equivalence that allows us to talk about intensional languages.

That said, I think I've provided evidence here that we have a notion of
how to bring intensionality to a language like Joy that's robust
to exactly which primitive you introduce for it.

Although Joy is a very minimalist setting to work in,
it wouldn't be difficult to bring these operators into richer language
as long as that language had the same basic syntactic structure.
For example,
one of the key assumptions we're making about the syntactic structure of the language
is that we don't have to think about variable binding.

I think that, at the moment, the resarch of Dr. Jay and collaborators
also leans on this conceptual simplification ---
it's the reason their intensional calculi are based on combinatory calculi rather than
lambda calculus.
It may be possible to move past this limitation by bringing in ideas
from languages with native ideas of variable binding, like &lambda;Prolog and FreshML,
but I will need more research to figure out exactly what these languages are doing.

## What do the full versions of the reductions look like?

The reader is encouraged to try putting together some real Joy code
that implements `map` in terms of `quota` and vice versa.
