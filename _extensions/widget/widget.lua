-- {{< widget NAME [attr=value ...] [alt="..."] >}}
--
-- HTML: emits <ul-NAME attr="value"> with the widget's poster images inside
-- it, plus its script. The poster shows until the widget starts (no blank
-- box, no jump) and again if it fails. Browsers run an ES module once per
-- URL, so a widget used several times on a page loads once.
--
-- Other formats (PDF, EPUB): the poster image and a link to the live widget.
--
-- Numbering and captions come from Quarto, not from here. Wrap the shortcode
-- in a `wid` block to number it (caption in the margin):
--
--   ::: {#wid-coin-flip}
--   {{< widget coin-flip p=0.5 >}}
--   Caption text.
--   :::
--
-- Leave the block out for an unnumbered widget (e.g. the Welcome page).

local function esc(s)
  return (s:gsub('&', '&amp;'):gsub('"', '&quot;'):gsub('<', '&lt;'))
end

local function exists(path)
  local f = io.open(path, 'r')
  if f then f:close() return true end
  return false
end

local function project_dir()
  return (quarto.project and quarto.project.directory) or '.'
end

return {
  ['widget'] = function(args, kwargs, meta)
    local name = pandoc.utils.stringify(args[1] or '')
    if not name:match('^[a-z][a-z0-9%-]*$') then
      error('widget: give a widget name, e.g. {{< widget two-pendulums >}}')
    end
    local alt = pandoc.utils.stringify(kwargs['alt'] or '')
    if alt == '' then alt = 'Interactive figure: ' .. name:gsub('%-', ' ') end
    local dir = project_dir() .. '/widgets/' .. name .. '/'
    local has_poster = exists(dir .. 'poster-light.png')

    if not quarto.doc.is_format('html') then
      local site = meta and meta.book and meta.book['site-url'] and pandoc.utils.stringify(meta.book['site-url']) or ''
      local blocks = {}
      if has_poster then
        table.insert(blocks, pandoc.Para({ pandoc.Image({ pandoc.Str(alt) }, 'widgets/' .. name .. '/poster-light.png') }))
      end
      local note = { pandoc.Emph({ pandoc.Str('Interactive figure: try it yourself in the online edition') }) }
      if site ~= '' then
        table.insert(note, pandoc.Str(': '))
        table.insert(note, pandoc.Link(site, site))
      end
      table.insert(blocks, pandoc.Para(note))
      return blocks
    end

    local attrs = {}
    for k, v in pairs(kwargs) do
      local val = pandoc.utils.stringify(v)
      if k ~= 'alt' and val ~= '' then table.insert(attrs, string.format(' %s="%s"', k, esc(val))) end
    end
    table.sort(attrs)
    local root = (quarto.project and quarto.project.offset) or '.'
    local src = root .. '/widgets/' .. name .. '/'
    local poster = ''
    if has_poster then
      poster = string.format(
        '<img class="ul-poster ul-poster-light" src="%sposter-light.png" alt="%s" loading="lazy">' ..
        '<img class="ul-poster ul-poster-dark" src="%sposter-dark.png" alt="%s" loading="lazy">',
        src, esc(alt), src, esc(alt))
    end
    local html = string.format('<ul-%s%s>%s</ul-%s>\n<script type="module" src="%s%s.js"></script>',
      name, table.concat(attrs), poster, name, src, name)
    return pandoc.RawBlock('html', html)
  end
}
