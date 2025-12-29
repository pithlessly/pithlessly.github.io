local footnote_section = HTML.select_one(page, "section#footnotes")
local footnote_elements = HTML.select(page, "fn")

function append_all(parent, children)
  local i = 1
  local count = size(children)
  while i <= count do
    HTML.append_child(parent, children[i])
    i = i + 1
  end
end

function make_footnote_body(footnote_elt, before, after)
  local multiline = HTML.get_attribute(footnote_elt, "multiline")
  if not multiline then
    local p = HTML.create_element("p")
    HTML.append_child(p, before)
    HTML.append_child(p, HTML.parse(HTML.inner_html(footnote_elt)))
    append_all(p, after)
    return p
  else
    local div = HTML.create_element("div")
    local content_source = HTML.select_one(page, "#" .. multiline)
    HTML.append_child(div, HTML.parse(HTML.inner_html(content_source)))
    HTML.delete_element(content_source)
    local paragraphs = HTML.select(div, "p")
    local first_paragraph = paragraphs[1]
    local last_paragraph = paragraphs[size(paragraphs)]
    HTML.prepend_child(first_paragraph, before)
    append_all(last_paragraph, after)
    return div
  end
end

function create_footnote(footnote_section, number, footnote_elt)
  local sup = HTML.create_element("sup")
  local a = HTML.create_element("a")
  HTML.set_attribute(a, "id", "footnote-" .. number .. "-link")
  HTML.set_attribute(a, "href", "#footnote-" .. number)
  HTML.append_child(a, HTML.create_text(number))
  HTML.append_child(sup, a)
  local backlink = HTML.create_element("a")
  HTML.set_attribute(backlink, "href", "#footnote-" .. number .. "-link")
  HTML.append_child(backlink, HTML.create_text("↩︎"))
  local before = HTML.create_text(number .. ": ")
  local after = { HTML.create_text(" "), backlink }
  local footnote_body = make_footnote_body(footnote_elt, before, after)
  HTML.set_attribute(footnote_body, "id", "footnote-" .. number)
  HTML.add_class(footnote_body, "highlightable")
  HTML.append_child(footnote_section, footnote_body)
  HTML.replace(footnote_elt, sup)
end

if footnote_section then
  local i = 1
  local count = size(footnote_elements)
  while i <= count do
    create_footnote(footnote_section, i, footnote_elements[i])
    i = i + 1
  end
end
