// House rules for widget words (widgets/README.md, "Fits one screen"):
// a status message is at most 80 characters (two lines on a phone), and a
// button label at most 14 (so a row of buttons fits one line at 360 px).
// Widgets list their status keys in `static status` and button keys in
// `static buttons`; this test reads them from the source, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const STATUS_MAX = 80, LABEL_MAX = 14;
const root = new URL('../../widgets/', import.meta.url);
const list = (src, name) => { const m = src.match(new RegExp(`static ${name} = (\\[[^\\]]*\\]);`)); return m ? JSON.parse(m[1].replace(/'/g, '"')) : null; };
const strings = (src) => {
  const a = src.indexOf('static strings = ') + 'static strings = '.length, b = src.indexOf('} };', a) + 3;
  return new Function(`return ${src.slice(a, b)}`)().en;
};

for (const dir of readdirSync(root, { withFileTypes: true })) {
  const file = new URL(`${dir.name}/${dir.name}.js`, root);
  if (!dir.isDirectory() || !existsSync(file)) continue;
  const src = readFileSync(file, 'utf8');
  const status = list(src, 'status'), buttons = list(src, 'buttons');
  if (!status && !buttons) continue;
  test(`${dir.name}: words fit the house limits`, () => {
    const en = strings(src);
    for (const k of status ?? []) {
      assert.equal(typeof en[k], 'string', `status key ${k} missing`);
      assert.ok(en[k].length <= STATUS_MAX, `status "${k}" is ${en[k].length} characters (max ${STATUS_MAX}): ${en[k]}`);
    }
    for (const k of buttons ?? []) {
      assert.equal(typeof en[k], 'string', `button key ${k} missing`);
      assert.ok(en[k].length <= LABEL_MAX, `button "${k}" is ${en[k].length} characters (max ${LABEL_MAX}): ${en[k]}`);
    }
  });
}
