const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('vite.config.js exists and sets a relative base path', () => {
  const file = path.join(root, 'vite.config.js');
  assert.ok(fs.existsSync(file), 'vite.config.js must exist for correct GitHub Pages asset paths');
  const contents = fs.readFileSync(file, 'utf8');
  assert.match(contents, /base:\s*["']\.\/["']/, 'base must be a relative path, not an absolute root');
});

test('public/manifest.webmanifest exists and is valid JSON referencing a local icon', () => {
  const file = path.join(root, 'public', 'manifest.webmanifest');
  assert.ok(fs.existsSync(file), 'public/manifest.webmanifest must exist');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(manifest.icons?.length, 'manifest must declare at least one icon');
  for (const icon of manifest.icons) {
    assert.ok(!/^https?:/.test(icon.src), 'icons must be local, not remote URLs');
    assert.ok(fs.existsSync(path.join(root, 'public', icon.src.replace(/^\.\//, ''))), `icon file ${icon.src} must exist on disk`);
  }
});

test('public/sw.js exists, is a real file (not an inline Blob), and bumps/keeps lifecycle hooks', () => {
  const file = path.join(root, 'public', 'sw.js');
  assert.ok(fs.existsSync(file), 'public/sw.js must exist as a static file');
  const contents = fs.readFileSync(file, 'utf8');
  assert.match(contents, /skipWaiting\(\)/, 'install must call skipWaiting so updates take effect promptly');
  assert.match(contents, /clients\.claim\(\)/, 'activate must call clients.claim so the new SW controls open pages');
});

test('index.html registers the static sw.js file, not an inline Blob service worker', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /navigator\.serviceWorker\.register\(['"]\.\/sw\.js['"]\)/, 'registration must point at a real file');
  assert.doesNotMatch(html, /new Blob\(\[\s*swCode/, 'inline-Blob service worker registration must be removed');
});

test('GitHub Pages deploy workflow exists and runs tests before building', () => {
  const file = path.join(root, '.github', 'workflows', 'deploy-pages.yml');
  assert.ok(fs.existsSync(file), '.github/workflows/deploy-pages.yml must exist so pushes to main actually deploy');
  const contents = fs.readFileSync(file, 'utf8');
  assert.match(contents, /npm test/);
  assert.match(contents, /npm run build/);
});

test('package.json has exactly one top-level "scripts" key with the expected scripts', () => {
  const file = path.join(root, 'package.json');
  const raw = fs.readFileSync(file, 'utf8');
  const scriptsKeyCount = raw.match(/^\s*"scripts"\s*:/gm)?.length || 0;
  assert.equal(scriptsKeyCount, 1, 'package.json must have exactly one top-level "scripts" key (it has had a duplicate before)');
  const pkg = JSON.parse(raw);
  for (const script of ['dev', 'build', 'preview', 'test']) {
    assert.ok(pkg.scripts[script], `package.json scripts must still include "${script}"`);
  }
});

test('dist/ (build output) is gitignored', () => {
  const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(gitignore, /^dist\/?\s*$/m, 'dist/ must be gitignored so stale build output never gets committed');
});
