# There are no odd-length no-ops in brainfuck

<time datetime="2022-03-17">Date: 2022-03-17</time>

[Brainfuck](https://en.wikipedia.org/wiki/brainfuck) is a programming language designed by Urban
Müller in 1993 which is intentionally very simple to describe but difficult to use. The program's
state is an array of integers and a "cursor" pointing into that array. The syntax only considers
eight commands:

- `+` increments the integer pointed to by the cursor.
- `-` decrements the integer pointed to by the cursor.
- `>` moves the cursor one element to the left.
- `<` moves the cursor one element to the right.
- `,` reads a byte from STDIN and stores it in the element pointed to by the cursor.
- `.` writes the integer pointed to by the the cursor to STDOUT as a single character.
- `[` begins a while loop. The loop condition is that the value pointed to by the cursor is nonzero.
- `]` ends a while loop.

When you run a sequence of commands, some configurations of the tape (the cursor and the tape's
contents) will end up exactly the same as they started. Some sequences of commands always do
nothing; we call them "no-ops". This post will describe a simple proof that all no-ops consist of an
even number of commands.

## What we mean by brainfuck

One of the problems with trying to get a handle on brainfuck is that the language isn't very
standardized. Are you allowed to go left of the starting cell? How large is the tape? Does it
dynamically expand if you go outside its bounds, does it wrap around to the start, or is it
undefined behavior? What happens if you try to read from STDIN and there isn't any more input to
read? Implementations handle all of these cases differently.

For the sake of simplicity, I'm going to assume that the tape is infinite (or grows dynamically) in
both directions, like a Turing machine, and that tape cells contain either unbounded integers or
bounded integers with wrapping behavior on overflow. This shouldn't affect the answer much, because
it's more or less the loosest possible interpretation of what brainfuck programs are legal. Anything
we prove is impossible in this setting must be impossible in a more restricted interpretation of the
language. Also, since any program that does IO using the `,` or `.` commands counts as having an
effect (and this effect can't be undone), any program that executes these can't be a no-op.

## The proof

The existence of *even*-length no-ops in this setting is straightforward: some pairs of instructions
cancel out, like `<>`, `><`, `+-`, `-+`, as well as combinations of these, like
`<+++>>-<->+<<--->+`.

Also, some subprograms have the property that their only behavior is to modify the values of cells
neighboring the data pointer by some fixed amount and move the data pointer left or right by some
fixed amount. For example, the subprogram `-<+>->` increases the cell to the right of the data
pointer by 1, decreases the cell at the data pointer by 2, and ends with the data pointer moved one
cell to the right. We can refer to these subprograms as **linear**. Note that the empty program is
linear, as well as the four single-character programs `+ - > <`.

**Proposition 1.** If `a` and `b` are linear subprograms, then `ab` is linear.

<div class="proof">

**Proof.** The cells modified by `b` are at a fixed offset from the start of `b`, which is itself at
a fixed offset from the start of `a`. So these modifications can be regarded as shifted over by
`a`'s offset and then merged with `a`'s modifications, and the offset of `ab` is the sum of the
offsets of `a` and `b`.

</div>

(Since the effect of a linear subprogram can also be undone by another linear subprogram, it follows
that linear subprograms form a group with concatenation as the binary operation and the empty
program as the identity.)

**Proposition 2.** If `a` and `b` are arbitrary subprograms, then `a[b]` is *not* linear.

<div class="proof">

**Proof.** `a[b]` has the property that, given any starting configuration, it either loops forever
(which would clearly make it non-linear) or halts. When it halts, the data pointer will always be on
a cell with zero value (since this is the definition of `[...]`). No linear subprogram can have this
property. Say a linear subprogram left the data pointer on a cell whose value was originally `n` and
changed it to zero. Then running it on a configuration where the cell was a different value, say
`n+k`, should result in its value becoming `k`, not zero, which is a contradiction.

</div>

**Proposition 3**. A subprogram is linear iff it consists only of the `+ - > <` commands, with no loops.

<div class="proof">

**Proof.** Clearly, any program which contains only these commands must be linear, since each of the
individual commands is linear. Conversely, consider a program containing a loop. It can be written
as `a[b]c`, where `c` is linear. But if the overall program is linear, then
<code>a[b]cc<sup>-1</sup> = a[b]</code> would also be linear (by 1), which is impossible (by 2).

</div>

This is the most important part of the proof, since it lets us restrict our search to programs
containing no loops (since no-ops are linear). At this point, the fact that there are no even-length
no-ops might be obvious, but I'll prove it anyway:

Define the **invariant** of a linear subprogram to be the integer which is the sum of the data
pointer offset and the changes it makes to the tape. It is easy to see that
`invariant(ab) = invariant(a) + invariant(b)`, and `invariant(+) = invariant(>) = 1` while
`invariant(-) = invariant(<) = -1`.

**Proposition 4.** The number of commands in a linear subprogram and its invariant have the same
parity. From this it follows that only even length programs can have an invariant of 0.

<div class="proof">

**Proof.** Every linear subprogram is constructed from the `+ - > <` commands, which all have odd
invariants.

</div>

## Why does this matter?

It's not entirely obvious (my first thought was to come up with some kind of mechanism involving
loops that you could use to ferry the data pointer to some safe location in the tape, perform a
useless operation, and then move it back). It is also a little more difficult to prove than I
expected it to be.
