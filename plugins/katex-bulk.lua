inline_math_selectors = { "p > math", "li > math", "figcaption > math", ".inline" }
display_math_selectors = { "article > math", ".display" }

function find_math_elements()
  return HTML.select_all_of(page, { "math", "span.math" })
end

function classify_math(elt)
  local content = HTML.inner_text(elt)
  local is_inline
  if HTML.matches_any_of_selectors(page, elt, inline_math_selectors) then
    is_inline = 1
  elseif HTML.matches_any_of_selectors(page, elt, display_math_selectors) then
    is_inline = 0
  else
    Log.warning(format("convert-math: unable to classify math element as inline or display: %s", JSON.to_string(content)))
    is_inline = 1
  end
  return { is_inline = is_inline, content = content }
end

function build_katex_inputs(math_elements)
  local count = size(math_elements)
  local i = 1
  local desc = {}
  while i <= count do
    desc[i] = classify_math(math_elements[i])
    i = i + 1
  end
  return desc
end

function katex_convert(inputs)
  local output = Sys.get_program_output("node scripts/katex_bulk.js", JSON.to_string(inputs))
  -- Log.warning("convert-math: katex_bulk output: " .. output)
  return JSON.from_string(output)
end

function replace_math_elements(math_elements, katex_outputs)
  local count = size(katex_outputs)
  local i = 1
  while i <= count do
    HTML.replace_element(math_elements[i], HTML.parse(katex_outputs[i]))
    i = i + 1
  end
  Log.info(format("convert-math: made %d replacements", count))
end

function main()
  local math_elements = find_math_elements()
  local katex_inputs = build_katex_inputs(math_elements)
  local katex_outputs = katex_convert(katex_inputs)
  replace_math_elements(math_elements, katex_outputs)
end

main()
