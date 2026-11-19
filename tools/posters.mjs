// Generate poster images for every widget that has a poster.js:
//   npm run posters                 (all)
//   npm run posters trisolaran-sky  (one)
// Writes widgets/<name>/poster-light.png and poster-dark.png. Commit them.
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, launch, widgetNames, ROOT } from './browser.mjs';

const names = process.argv.slice(2).length ? process.argv.slice(2) : await widgetNames();
const server = await serve(), browser = await launch(), page = await browser.newPage();
for (const name of names) {
  try { await access(join(ROOT, 'widgets', name, 'poster.js')); } catch { continue; }
  for (const theme of ['light', 'dark']) {
    await page.goto(`${server.url}/widgets/gallery/poster.html?widget=${name}&theme=${theme}`);
    const { png } = await page.waitForFunction(() => window.poster, null, { timeout: 30000 }).then((h) => h.jsonValue());
    const file = join(ROOT, 'widgets', name, `poster-${theme}.png`);
    await writeFile(file, Buffer.from(png.split(',')[1], 'base64'));
    console.log('wrote', file.replace(ROOT, ''));
  }
}
await browser.close(); server.close();
