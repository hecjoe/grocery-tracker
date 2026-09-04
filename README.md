# Grocery Tracker

Client-side grocery and budget tracker with on-device shelf-tag OCR.

```bash
npm install
npm run dev
```

Run checks and create the production site with:

```bash
npm test
npm run build
```

GitHub Pages is deployed from Vite's generated `dist` directory by
`.github/workflows/deploy-pages.yml`. In the repository's Pages settings, select
**GitHub Actions** as the source.

OCR runs in the browser; captured images are never sent to an OCR service.
The build copies Tesseract's worker, WebAssembly core, and English language data
from installed npm packages, so the deployed scanner makes no third-party runtime
requests.
