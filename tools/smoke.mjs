// Browser smoke test for every widget in the gallery:
//   npm run smoke
// For each widget, at phone and desktop width, in light and dark: it mounts,
// runs for a moment with no console errors, and its screenshot is saved to
// tests/screens/ (not committed) for review.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { serve, launch, widgetNames, ROOT } from './browser.mjs';

const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };
const out = join(ROOT, 'tests', 'screens');
await mkdir(out, { recursive: true });

const server = await serve(), browser = await launch();
let failures = 0;
for (const name of await widgetNames()) {
  for (const [size, viewport] of Object.entries(SIZES)) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      // Web fonts may be unreachable offline; a missing favicon is not ours.
      const ignore = (url) => /fonts\.(googleapis|gstatic)|favicon/.test(url);
      page.on('console', (m) => m.type() === 'error' && !/^Failed to load resource/.test(m.text()) && errors.push(m.text()));
      page.on('requestfailed', (r) => !ignore(r.url()) && errors.push(`failed: ${r.url()}`));
      page.on('response', (r) => r.status() >= 400 && !ignore(r.url()) && errors.push(`${r.status()}: ${r.url()}`));
      await page.goto(`${server.url}/widgets/gallery/#${name}`);
      await page.addStyleTag({ content: '.tuner { display: none !important; }' });   // gallery dials would cover the widget
      if (theme === 'dark') await page.evaluate(() => { document.body.classList.replace('quarto-light', 'quarto-dark'); });
      const el = page.locator(`ul-${name}:visible`).last();   // some widgets have phone and desktop copies
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      const mounted = await el.evaluate((w) => w._mounted === true && !w._failed);
      if (!mounted) errors.push('did not mount');
      await el.screenshot({ path: join(out, `${name}-${size}-${theme}.png`) });
      const ok = errors.length === 0;
      if (!ok) failures++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${size} ${theme}${ok ? '' : '\n     ' + errors.join('\n     ')}`);
      await page.close();
    }
  }
}
await browser.close(); server.close();
process.exitCode = failures ? 1 : 0;
