// Shared helper for the dev tools: serve the repo over HTTP (ES modules need
// it) and open a headless Chromium. Set CHROME=/path/to/chrome to use a
// browser you already have; otherwise run `npx playwright-core install chromium` once.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

export async function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = path.endsWith('/') ? path + 'index.html' : path;
    try {
      const body = await readFile(join(ROOT, file));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

export const launch = () => chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

// Every widget folder that has a custom element file of the same name.
export async function widgetNames() {
  const { readdir, access } = await import('node:fs/promises');
  const out = [];
  for (const d of await readdir(join(ROOT, 'widgets'), { withFileTypes: true })) {
    if (!d.isDirectory() || ['core', 'engines', 'gallery', 'vendor'].includes(d.name)) continue;
    try { await access(join(ROOT, 'widgets', d.name, `${d.name}.js`)); out.push(d.name); } catch { /* not a widget */ }
  }
  return out;
}

export { ROOT };
