module A = struct
  type adt = Foo
end

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
