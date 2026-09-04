import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "public", "tesseract");

const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"]
];

await rm(outputRoot, { recursive: true, force: true });

for (const [source, destination] of assets) {
  const destinationPath = join(outputRoot, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(join(projectRoot, source), destinationPath);
}

console.log(`Prepared ${assets.length} local Tesseract assets.`);
