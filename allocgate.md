# Allocgate is coming in Zig 0.9, and you will have to change your code

<time datetime="2021-12-15">Date: 2021-12-15</time>

Version 0.9 of [the Zig programming language](https://ziglang.org) is planned to release in about a
week. One of the major changes coming in this release is a restructuring of how allocators work,
which has been termed [Allocgate](https://github.com/ziglang/zig/issues/10052). This is a breaking
change to the `Allocator` API provided by the standard library, so pretty much any code that uses
allocators will have to be updated in response. I hope to use this article to explain the
justification for this change and what steps you need to take to adjust your code.

The TL;DR is:
- Where you previously passed around `*Allocator` to functions that need to
  allocate, you now pass around `Allocator` directly. `Allocator` is now a
  struct, which is the size of two pointers.
- When you construct an allocator (such as
  `var gpa: std.heap.GeneralPurposeAllocator(.{});`), you call
  `gpa.allocator()` to get the type-erased allocator implementation
  rather than writing `&gpa.allocator`.

Unless you are writing your own allocator, this should be all you need to change.

## Two ways to approach polymorphism

Zig's allocators rely on dynamic dispatch. The choice of allocation and deallocation functions is
not known until runtime, so if you want to write code that is agnostic to the user's choice of
allocator (and you generally do when writing library code), you need to accept these functions as a
parameter in some way. Most languages use a structure called a *virtual function table* (vtable)
which stores the addresses of each dynamically-known function. Zig's standard library provides a
variety of allocators (such as `ArenaAllocator` and `GeneralPurposeAllocator`), each of which has
some associated state along with a set of functions (`alloc`, `resize`, and `free`) which operate on
that state to work as a memory allocator. The addresses of these three functions are collected into
an "allocator vtable".

Any polymorphic object's state needs to be passed along with its vtable somehow. One way to do it is
to represent an object as a pair of pointers: one to the object's fields, and one to a vtable which
knows how to operate on those fields. I'll follow Rust's terminology and call this `(impl, vtable)`
pair a "fat pointer".

```
 Dynamic           Object
----------        ----------
| impl   | -----> | fields |
|--------|        | ...    |
| vtable | ---.   ----------
----------    |
              |    Vtable
              |   ----------
              `-> | alloc  |
                  | resize |
                  | free   |
                  ----------
```

Another way would be to store a separate copy of the vtable in every object. By knowing its address,
the vtable's functions would be able to deduce the address of the struct containing them, an
operation sometimes called `container_of` in C and provided by Zig under the name `@fieldParentPtr`.
Indeed, this is such a common use of this builtin that the technique is commonly described as just
"the `@fieldParentPtr` idiom."

```
                   Object
                  --------------
                  | fields     |
 Dynamic          | ...        |
----------        | ---------- |
| vtable | -------> | alloc  | |
----------        | | resize | |
                  | | free   | |
                  | ---------- |
                  | ...        |
                  --------------
```

(We could also imagine a third solution in which the object contains a pointer to the vtable in its
fields, and we pass around a pointer to that pointer. This has the advantage of sharing vtables,
while still requiring only a single pointer to be passed around. However, this also means we would
need a double indirection to access the vtable, which would be more expensive.)

## Polymorphic allocators in Zig

Without stooping so low as to actually *benchmark*, what might the respective advantages of these
two approaches be?

- Using fat pointers, we get to make fewer copies of the vtable. Every polymorphic value can point
  to the same one, which saves memory and allows dynamic objects to be smaller.
- With the `@fieldParentPtr` approach, we're able to pass a dynamic object around as just a single
  pointer. This improves performance and saves memory for any struct that needs to hold a dynamic
  allocator (notably, most `std` containers).

In the case of allocators, it might seem like the `@fieldParentPtr` approach would win out. After
all, the average program passes relatively many pointers to relatively few different allocators, so
making the latter large at the expense of keeping the former small is a sensible trade-off.

However, as it turns out, this approach has a performance problem with has to do with a compiler
optimization known as *devirtualization*. Virtual function calls are more expensive than calls to
known functions for a number of reasons, so LLVM would like to rewrite them to static calls anywhere
it can prove that a function pointer always has a particular value. This becomes more difficult when
the function pointer lives inside a structure like `GeneralPurposeAllocator`. Zig's `struct`s don't
even have compile-time encapsulation, much less runtime encapsulation. There is nothing stopping you
from reaching into your `GeneralPurposeAllocator` and changing the vtable functions to do something
else. It would definitely be against `std`'s contract, but it wouldn't immediately cause undefined
behavior. This means any code which reads vtables out of the embedded `Allocator` has to be
defensive against the possibility that the vtable was modified, making devirtualization impossible.

In contrast, when using fat pointers, the vtables are shared constant objects, and a new fat pointer
is constructed on every call to `gpa.allocator()`. So while we incur the cost of passing around a
larger fat pointer, the allocation and deallocation functions potentially become much faster to
call.

## Allocgate

As far as I can tell, the performance issues of the `@fieldParentPtr` approach were first noticed
[about two months ago](https://github.com/ziglang/zig/issues/10037) in the `std.rand` API, which
uses a similar approach to allow code to be polymorphic over the caller's choice of RNG algorithm
(perhaps the performance issues were more apparent here because RNG algorithms are designed to have
high throughput, so the relative overhead of indirect calls is larger). It was noted in that issue
that any other code using this approach would suffer the same problem.

With Allocgate, the `std.mem.Allocator` API was also changed from embedded vtables to fat pointers.
This is the reason behind the two API changes I mentioned at the beginning of the article:
`Allocator` was changed from holding the vtable itself to being a fat pointer struct, and you call
`gpa.allocator()` instead of `&gpa.allocator` because the vtable is no longer a field of the
allocator and you instead need to construct a fat pointer.

This also happens to address a specific failure mode I have run into before, where instead of writing

```
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const alloc = &gpa.allocator;
```

the user writes:

```
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
var alloc = gpa.allocator;
```

This *copies* the allocator out of its parent struct and then attempts to call methods like
`alloc.alloc()`. This will generally compile correctly (since Zig will automatically take the
address of an object when calling a method that takes `self` by pointer), but causes undefined
behavior at runtime because `alloc` attempts to use `@fieldParentPtr` despite no longer being
contained in the struct it expects to be in. Post-Allocgate, this code instead becomes:

```
var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const alloc = gpa.allocator();
```

... which is pretty much impossible to silently get wrong.

## What's next for vtable-based polymorphism?

Allocgate has been [merged into Zig's master branch](https://github.com/ziglang/zig/pull/10055) and
should ship in Zig 0.9. This involved an impressive amount of work, with much of the standard
library needing to be changed. It should hopefully yield better performance for code that uses any
of the standard library's allocator abstractions. Zig's contributors have gone back and forth on the
specifics of the change, and looked at a number of benchmarks, but I'm sure they would welcome
additional data on this.

I think this is a great example of the kind of ecosystem-wide improvements Zig can make as a
relatively young language that has yet to tie itself to any stability guarantees. It sucks for
language users who will have to change their code, of course, but hopefully they knew what they were
getting into. One of Zig's principles is "avoid local maxima," which, at this point in the
language's evolution, means to be willing to move to a better solution even if it means breaking
backwards compatibility.

A number of topics are also being discussed that have the potential to further improve the
performance and ergonomics of runtime polymorphism. For example, it could be that improvements to
Zig or LLVM's aliasing model will make it easier to optimize virtual function calls (for example, by
making it possible to mark a particular field of a struct as immutable). Zig's developers have also
expressed some interest in having first-class support for interfaces in the standard library or even
the language itself, which would make it easier for the user and reduce the burden of having to
modify every API in the standard library when changes like this are made.

## Credit for the change

I had no personal involvement in Allocgate. I am simply an outsider who is interested in Zig and
thought others might benefit from an explanation of this change. Instead, I ought to credit:

- Andrew Kelley ([@andrewrk](https://github.com/andrewrk)), creator of Zig and initial designer of
  the allocator API;
- [@ominitay](https://github.com/ominitay), who first diagnosed the problem in `std.rand` and
  provided benchmarks;
- Martin Wickham ([@SpexGuy](https://github.com/SpexGuy)), who discovered the optimization problems
  with LLVM and the need to move away from `@fieldParentPtr`-based APIs;
- Lee Cannon ([@leecannon](https://github.com/leecannon), who implemented the bulk of the change to
  `Allocator`, including updating the entire standard library;
- and everyone else who contributed feedback, bug fixes, and benchmarks on the PR.
