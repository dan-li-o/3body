-- hide-todo.lua: keep TODOs in the source, keep them off the published site.
--
-- Write a TODO as an inline span  [TODO: find the source]{.todo}
-- or as a block                   ::: {.todo} ... :::
--
-- On the site (the default) every .todo span and block is removed. A footnote
-- or a margin note left empty by the removal is removed too.
-- To see them while writing, preview with the draft profile:
--     quarto preview --profile draft
-- which sets `show-todos: true`; TODOs then stay, styled orange (theme/book.scss).

local show = false

local function is_todo(el) return el.classes:includes('todo') end

local function blank(blocks)
  return pandoc.utils.stringify(pandoc.Div(blocks)):match('^%s*$') ~= nil
end

local strip = {
  Span = function(el) if is_todo(el) then return {} end end,
  Div  = function(el) if is_todo(el) then return {} end end,
}

local tidy = {
  -- a footnote that only held a TODO
  Note = function(el) if blank(el.content) then return {} end end,
  -- a margin note that only held a TODO
  Div = function(el)
    if el.classes:includes('column-margin') and blank(el.content) then return {} end
  end,
}

local mark = {
  Span = function(el) if is_todo(el) then el.classes:insert('todo-visible') return el end end,
  Div  = function(el) if is_todo(el) then el.classes:insert('todo-visible') return el end end,
}

function Pandoc(doc)
  local m = doc.meta['show-todos']
  show = m == true or (m and pandoc.utils.stringify(m) == 'true')
  if show then return doc:walk(mark) end
  return doc:walk(strip):walk(tidy)
end
