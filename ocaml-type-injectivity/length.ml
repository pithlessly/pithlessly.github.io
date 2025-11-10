module Length : sig

  type length

  val from_cm : float -> length
  val from_in : float -> length
  val add : length -> length -> length

end = struct

  type length = float (* represented in cm *)
  let from_cm x = x
  let from_in x = x *. 2.54
  let add a b = a +. b

end
