// Generate poster images for every widget that has a poster.js:
//   npm run posters                       (all)
//   npm run posters trisolaran-sky        (one)
//   npm run posters -- --check            (all; change nothing, exit 1 if a committed poster is stale)
// Writes widgets/<name>/poster-light.png and poster-dark.png. Commit them.
//
// Each poster is drawn in the browser by widgets/gallery/poster.html (the book's fonts and
// design tokens, the widget's own engine), then saved as a 256-colour palette PNG with sharp
// (libimagequant): about 80-85% smaller than the browser's PNG, and the same to the eye.
// Posters are at most MAX_PX wide: the book column is 672 CSS px, so 1600 px covers 2x screens.
import { writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { serve, launch, widgetNames, ROOT } from './browser.mjs';

const MAX_PX = 1600;
const args = process.argv.slice(2);
const check = args.includes('--check');
const names = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : await widgetNames();

// The PNG we commit: palette-quantised, maximum compression. Deterministic for the same input.
const encode = (png) => sharp(png).png({ palette: true, colours: 256, quality: 100, dither: 0.5, effort: 10, compressionLevel: 9 }).toBuffer();
// Pixels, for comparing a committed poster with a fresh one.
const pixels = async (buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const server = await serve(), browser = await launch(), page = await browser.newPage();
let stale = 0;
for (const name of names) {
  try { await access(join(ROOT, 'widgets', name, 'poster.js')); } catch { continue; }
  for (const theme of ['light', 'dark']) {
    await page.goto(`${server.url}/widgets/gallery/poster.html?widget=${name}&theme=${theme}&max=${MAX_PX}`);
    const { png, fonts } = await page.waitForFunction(() => window.poster, null, { timeout: 30000 }).then((h) => h.jsonValue());
    if (fonts.length) throw new Error(`${name}: fonts did not load (${fonts.join(', ')}); the poster would use a fallback font`);
    const file = join(ROOT, 'widgets', name, `poster-${theme}.png`);
    const fresh = await encode(Buffer.from(png.split(',')[1], 'base64'));
    if (check) {
      let same = false;
      try {
        const [a, b] = await Promise.all([pixels(await readFile(file)), pixels(fresh)]);
        same = a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data);
      } catch { /* missing or unreadable: stale */ }
      if (!same) stale++;
      console.log(`${same ? 'ok   ' : 'STALE'} ${file.replace(ROOT, '')}`);
    } else {
      await writeFile(file, fresh);
      console.log(`wrote ${file.replace(ROOT, '')} (${Math.round(fresh.length / 1024)} KB)`);
    }
  }
}
await browser.close(); server.close();
if (check && stale) { console.error(`\n${stale} poster(s) differ from their poster.js: run npm run posters and commit.`); process.exitCode = 1; }
