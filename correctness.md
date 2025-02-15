# There is room for imperfect fault isolation

<time datetime="2022-12-06">Date: 2022-12-06</time>

In a discussion about the merits of non-volatile memory from a software perspective, Bryan Cantrill
[made a comment](https://youtu.be/lf6a_32vvbU?t=1308) which I think is worth digging
into:

> In many ways, the gnarliest bug I've ever been involved in debugging was a kernel data
corruption bug that managed to leap the fireline into ZFS. We had a couple of instances where that
wild kernel data corruption had corrupted a buffer that was on its way out to disk... In software,
we don't actually keep auxiliary data structures to allow us to repair our state in-memory, but
we're gonna need to do that in a world that's all non-volatile.

Whether an OS kernel's interface to persistent storage is a conventional one, or something that
looks like RAM, it still has privileged access to all the same functionality and is equally
susceptible to memory corruption. Yet the argument made here is that something about the nature of
the NVRAM interface makes it more likely for memory corruption within the kernel to escalate into a
more severe problem.

I think this is both true --- and *really uncomfortable to contemplate*. The data corruption
described here was probably a result of the dreaded Undefined Behavior. Conventionally, the way we
teach and reason about Undefined Behavior avoids thinking too hard about exactly what the
consequences will be. "The compiler doesn't make any guarantees about what will happen, so you have
to assume that anything could happen. You can't rely on anything useful happening, so it is best to
just never perform undefined behavior, and you'll never have to think about it." In this view, the
way to make software more robust is to use tools, practices, and languages that reduce the risk of a
program performing undefined behavior by mistake.

But this doesn't explain the issue at hand: the reason we might speculate that applications backed
by NVRAM for persistent storage might be less robust to memory corruption is that a wild pointer
could affect persistent data by pointing anywhere within the region of the address space mapped as
storage. With conventional storage, the corruption would need to hit a smaller target: a (often
short-lived) buffer representing data that is about to be written to persistent storage, or possibly
other memory locations representing the size of the buffer or the position on disk to write to. You
could do this same risk evaluation in user space for programs in unsafe languages that use
memory-mapped file I/O, especially because it is common practice to read these types of files by
directly type punning with C `struct`s, making it easier to not be careful about validating
everything.

This argument exposes the nuance within undefined behavior: the standard says that anything *could*
happen upon access to an invalid pointer, but in practice some anythings are much worse than others.
There is a spectrum of robustness, even when you can no longer rely on your abstractions to make any
hard-and-fast guarantees.

As someone who falls more on the theoretical side, I don't like the prospect of having to make these
considerations when designing software. When I see an interface that has some kind of undefined
condition, I would always hope that we can use better tools, practices, and languages to remove the
possibility of getting into this condition in the first place. Alternatively, we could wrap the
whole thing in a sandbox at runtime, to at least restrict the scope of what problems the undefined
behavior could cause.

What makes me uncomfortable is the idea of having to arbitrate between anythings. I don't want to
have to think about what my software does in situations where my normal mental model tells me it's
irreparably broken. It doesn't help that a lot of tooling is also built with the assumption that we
don't care about handling these cases.

But just because it makes me uncomfortable doesn't make it *wrong*. A sufficiently complex program,
no matter how carefully written, will inevitably reach cases where it fails to uphold its own
expectations. You might be able to prevent 99% of undefined behavior with static or language-level
solutions, but the burden of doing this rapidly approaches infinity as you try to move that
percentage closer to 100. Therefore, in domains where robustness is absolutely critical, we need to
acknowledge as a community that "abstinence-only undefined behavior education" is not enough.

(I want to emphasize that when I say "undefined behavior" here, I don't only mean at the language
level. It's also possible for libraries and applications to get into situations where "all bets are
off" because they can no longer trust their own invariants. We can think of undefined behavior in C
and friends to be a situation where the program does something that prevents the abstraction below
it --- the language --- from maintaining its invariants.)

## Case studies

A few more interesting examples, which might not all be totally related, but inform my thinking on this:

- [This r/rust thread](https://reddit.com/r/rust/comments/l7t980/is_there_a_paranoid_mode_in_the_compiler/),
  where the author asked about certain defensive C patterns that are used when you can't completely
  trust the hardware to retain values in memory. They wanted to know whether the same things could
  be done in Rust.

  The community's response was... mixed. One answer was, "well, you might be able to use the same
  patterns, but Rust doesn't have any features that make it easier, and it won't be easy to convince
  LLVM's optimizer that you aren't just doing a bunch of redundant checks." The other response was:
  "Are you sure it even makes sense for these safety checks to be the responsibility of the program
  logic? Shouldn't it be the job of the hardware, or at the very least the compiler, to ensure the
  program has a reasonably sane view of memory as a foundation on which to build things?"

  I don't think this is a good answer. It accuses the OP of having an XY problem in their entire
  choice of hardware. But the author doesn't seem naïve to me --- they have external engineering and
  budget constraints which mean this type of defensive C code really is the best option in that
  situation. It's understandable that they might look to Rust as a potential improvement.

  But the unfortunate truth is that all the decades of advances in language safety seem to have been
  built on the assumption that RAM is highly trustworthy, just as trustworthy as the CPU. (And
  anything with the potential to break that model, like local stack variables being spontaneously
  written by another thread, goes in the "undefined behavior" bin.) Modern languages offer the
  ability to build a higher tower of abstractions, which in turn depends on absolutely stable and
  sane foundations. This tradeoff makes sense for the vast majority of cases, but evidently not for
  the kind of constrained environment the OP has to work in.

- "Fail fast" is the usual advice given for error handling. If a program detects its own invariants
  being broken due to a bug, it's better to crash the entire program than to just log an error, try
  to do something reasonable, and carry on. PHP might be the most notorious representative of the
  alternative philosophy.

  There are two good arguments for this. The first is that bringing the whole program down means the
  bug is guaranteed to be visible, which introduces more pressure on the developers for it to be
  solved. But this is a social issue, not a technical one. It's not unthinkable that you could
  maintain a culture of caring about and reporting non-fatal errors, checking obscure log files,
  etc. Nor is it unthinkable to develop a culture which doesn't care enough about even fatal errors:
  "Eh, this thing crashes all the time, no use reporting it. It's just annoying like that."

  The second argument is that, if you let the program continue to run in a situation where you
  already know something has gone wrong due to a bug (so your mental model of what the program is
  supposed to do is no longer fully accurate), then you're risking that the broken invariants will
  spread more in the system state and create a more severe problem. But this creates to a vicious
  cycle! As long as we teach people that "fail fast" is the only reasonable thing to do upon
  encountering an inconsistency, we dissuade them from thinking about how the program might maintain
  some function in the face of these inconsistencies. We teach them that the only place to put fault
  isolation is at the boundary where one "process" recovers from an arbitrary crash in another.

- There's now Rust code in the Linux kernel, which has required Rust to adapt to some of the local
  conventions. In normal Rust, certain errors, like out-of-bounds indexing, normally cause a panic
  which doesn't return. But Linux needs to keep going when it hits an error like this, at least long
  enough that the error has a chance of being logged somewhere. So the right thing to use is usually
  something like the `WARN_ON_ONCE(...)` macro, which reports an error but doesn't immediately stop
  execution. In other words, it doesn't fail fast, instead trusting that some kind of imperfect
  fault isolation will limit the scope of the problem even though it doesn't have any strict
  guarantees about it. This means, if my understanding is correct, that Rust code in the kernel is
  sometimes expected to keep running even when doing so would be undefined behavior. A lot of Rust
  people [were not satisfied by this](https://lobste.rs/s/otyvbx/introductory_rust_support_merged_linux).
  But given that this pattern is widespread in Linux C code, it seems to be a concession they were
  willing to make in the name of getting Rust into the kernel for the sake of its other potential
  safety benefits.

## What does imperfect fault isolation in software actually look like?

I don't have a whole lot of useful thoughts about this. It's not what I originally planned this post
to be about. But I will say this much: if a program's state can be divided into different
subsystems, it can get fault isolation between these subsystems insofar as it avoids having code in
one subsystem depend on invariants of data belonging to another. I have a potential hot take, which
is that advice like "parse, don't validate" and "use the type system to enforce invariants" is
advising the opposite: introduce *more* coupling between the invariants or correctness of different
parts of the program. This kind of design even gets labeled as "elegant".
