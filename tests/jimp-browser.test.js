import test from "node:test";
import assert from "node:assert/strict";

test("the Jimp browser bundle can decode and preprocess an image", async () => {
  globalThis.self = globalThis;
  await import("jimp/browser/lib/jimp.js");
  const Jimp = globalThis.Jimp;
  assert.equal(typeof Jimp?.read, "function");

  const source = new Jimp(8, 8, 0xff4d00ff);
  const encoded = await source.getBufferAsync(Jimp.MIME_JPEG);
  const decoded = await Jimp.read(encoded);
  decoded.greyscale().contrast(0.25).quality(90);
  const output = await decoded.getBufferAsync(Jimp.MIME_JPEG);

  assert.ok(output.length > 0);
  assert.equal(decoded.bitmap.width, 8);
  assert.equal(decoded.bitmap.height, 8);
});
