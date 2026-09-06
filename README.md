# grocery-tracker

Costco price-tag scanning runs locally in the browser using Canvas and Tesseract.js v5.
`processScan()` locates and straightens the tag, compares OCR readings of the product-name
rows, and reads the largest printed price separately. Multiple OCR passes take longer
than the previous single-pass scanner. The existing review step still matters for
unfamiliar layouts, poor lighting, or blurred photos.

## OCR regression tests

With Node.js 22 or newer installed:

```sh
npm ci
npm test
```

The tests use Node's built-in test runner. Each test decodes an original fixture,
runs real Tesseract.js 5.1.1 OCR, and executes `processScan()` directly from `index.html`.
The DOM and browser Canvas interfaces have Node adapters; the extraction logic is
not copied or mocked. JPEG/WebP images are decoded to lossless PNG for the Node OCR
decoder, with no fixture-specific crops or substitutions.

The first run needs network access to download English language data. Subsequent runs
reuse `tests/.cache/` for that data; OCR results are never reused. Dependencies are
locked in `package-lock.json`. The browser CDN remains on the existing v5 URL.

All nine original fixtures and the user-confirmed exact expected names/prices live in
`tests/fixtures/costco-tags/`. Failures print raw OCR text and every word's bounding box
and confidence from every pass. Each run also saves JSON diagnostics and a snapshot
of the tested function under `tests/results/latest/`. Set `OCR_RUN` to a different
directory name to preserve a run. Generated results, language cache, and the local
portable Node runtime in `.tools/` are ignored by Git.

See [the baseline and every extraction iteration](tests/OCR_RESULTS.md) for actual
results. These are Node fixture tests; camera capture and performance on a phone
have not been tested.
