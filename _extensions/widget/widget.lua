-- {{< widget two-pendulums step=3 angle=69 >}}
-- Emits <ul-two-pendulums ...> plus its script. Browsers run an ES module
-- once per URL, so a widget used several times on a page loads once.
-- Non-HTML formats get a short note pointing to the online edition.

local function esc(s)
  return (s:gsub('&', '&amp;'):gsub('"', '&quot;'):gsub('<', '&lt;'))
end

return {
  ['widget'] = function(args, kwargs)
    local name = pandoc.utils.stringify(args[1] or '')
    if not name:match('^[a-z][a-z0-9%-]*$') then
      error('widget: give a widget name, e.g. {{< widget two-pendulums >}}')
    end
    if not quarto.doc.is_format('html') then
      return pandoc.Para({ pandoc.Emph({ pandoc.Str('[Interactive figure: see the online edition.]') }) })
    end
    local attrs = {}
    for k, v in pairs(kwargs) do
      local val = pandoc.utils.stringify(v)
      if val ~= '' then table.insert(attrs, string.format(' %s="%s"', k, esc(val))) end
    end
    table.sort(attrs)
    local root = (quarto.project and quarto.project.offset) or '.'
    local html = string.format(
      '<ul-%s%s></ul-%s>\n<script type="module" src="%s/widgets/%s/%s.js"></script>',
      name, table.concat(attrs), name, root, name, name)
    return pandoc.RawBlock('html', html)
  end
}
