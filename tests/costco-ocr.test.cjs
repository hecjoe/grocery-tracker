const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const root = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures/costco-tags');
const expected = require('./fixtures/costco-tags/expected.json');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// Execute the real function, rather than maintaining a second copy of its parser.
const start = html.indexOf('    async function processScan(event)');
const end = html.indexOf('    function updateQuantity', start);
assert.ok(start >= 0 && end > start, 'processScan source boundaries found');
const source = html.slice(start, end);
const results = path.join(__dirname, 'results', process.env.OCR_RUN || 'latest');
const cache = path.join(__dirname, '.cache');
fs.mkdirSync(results, { recursive: true });
fs.mkdirSync(cache, { recursive: true });
fs.writeFileSync(path.join(results, 'processScan.js'), source);

for (const fixture of expected) {
  test(fixture.file, { timeout: 180000 }, async () => {
    const scans = [];
    const elements = Object.fromEntries(
      ['scanButton', 'scanStatus', 'newItemName', 'newItemPrice'].map(id => [id, { value: '' }])
    );
    const errors = [];
    const context = {
      createImageBitmap: async image => {
        const decoded = await loadImage(image);
        decoded.close = () => {};
        return decoded;
      },
      document: {
        getElementById: id => elements[id],
        createElement: tag => { assert.equal(tag, 'canvas'); return createCanvas(1, 1); }
      },
      validateInput() {},
      console: { error: (...args) => errors.push(args.map(String).join(' ')) },
      Tesseract: {
        ...Tesseract,
        async createWorker(lang, oem = 1, options = {}, ...rest) {
          const worker = await Tesseract.createWorker(lang, oem, { ...options, cachePath: cache }, ...rest);
          const recognize = worker.recognize.bind(worker);
          worker.recognize = async (...args) => {
            const result = await recognize(...args);
            scans.push({ text: result.data.text, words: result.data.words.map(({ text, bbox, confidence }) => ({ text, bbox, confidence })) });
            return result;
          };
          return worker;
        },
        async recognize(image, lang, options = {}, ...rest) {
          const result = await Tesseract.recognize(image, lang, { ...options, cachePath: cache }, ...rest);
          scans.push({ text: result.data.text, words: result.data.words.map(({ text, bbox, confidence }) => ({ text, bbox, confidence })) });
          return result;
        }
      }
    };
    const runScan = new Function(...Object.keys(context), source + '\nreturn processScan;')(...Object.values(context));
    // Lossless format conversion only: the Node WASM decoder does not support WebP.
    const image = await sharp(path.join(fixtures, fixture.file)).png().toBuffer();
    const event = { target: { files: [image], value: 'fixture' } };
    await runScan(event);
    const actual = { name: elements.newItemName.value, price: elements.newItemPrice.value };
    const report = { fixture, actual, errors, scans };
    fs.writeFileSync(path.join(results, fixture.file + '.json'), JSON.stringify(report, null, 2));
    console.log(`${fixture.file}: ${JSON.stringify(actual)}`);
    try {
      assert.deepEqual(errors, []);
      assert.deepEqual(actual, { name: fixture.name, price: fixture.price });
      assert.equal(elements.scanButton.disabled, false);
      assert.equal(event.target.value, '');
    } catch (error) {
      console.error('OCR FAILURE DIAGNOSTICS: ' + JSON.stringify(report));
      throw error;
    }
  });
}
