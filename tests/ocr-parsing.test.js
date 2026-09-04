import test from "node:test";
import assert from "node:assert/strict";
import {
  extractItemName,
  findPriceCandidates,
  selectLargestPrice
} from "../src/ocr-parsing.js";

test("selects the price token with the tallest word bounding box", () => {
  const data = {
    words: [
      { text: "0.590", confidence: 98, bbox: { x0: 20, y0: 20, x1: 80, y1: 40 } },
      { text: "12.99", confidence: 96, bbox: { x0: 400, y0: 100, x1: 500, y1: 135 } },
      { text: "849", confidence: 87, bbox: { x0: 500, y0: 300, x1: 720, y1: 410 } },
      { text: "1932019", confidence: 99, bbox: { x0: 10, y0: 5, x1: 160, y1: 30 } }
    ]
  };

  const candidates = findPriceCandidates(data, "preprocessed");
  const selected = selectLargestPrice(candidates);

  assert.deepEqual(candidates.map(candidate => candidate.value), [12.99, 8.49]);
  assert.equal(selected.value, 8.49);
  assert.equal(selected.height, 110);
});

test("accepts comma decimals and prefers the lower word when heights tie", () => {
  const data = {
    words: [
      { text: "$13,49*", confidence: 90, bbox: { x0: 300, y0: 100, x1: 450, y1: 180 } },
      { text: "9.99", confidence: 90, bbox: { x0: 300, y0: 220, x1: 450, y1: 300 } }
    ]
  };

  const selected = selectLargestPrice(findPriceCandidates(data));
  assert.equal(selected.value, 9.99);
});

test("builds a multi-line Costco title below the item number and stops at bullets", () => {
  const data = {
    lines: [
      { text: "1932019 *" },
      { text: "KIRKLAND SIGNATURE MEN'S" },
      { text: "COTTON BOXER BRIEF 4 PACK" },
      { text: "• Dishwasher Safe" },
      { text: "PRICE PER OUNCE .590" }
    ]
  };

  assert.equal(
    extractItemName(data),
    "KIRKLAND SIGNATURE MEN'S COTTON BOXER BRIEF 4 PACK"
  );
});

test("falls back to the strongest uppercase text line", () => {
  const data = {
    lines: [
      { text: "12.99", confidence: 99 },
      { text: "ORGANIC CHICKEN BREAST", confidence: 91 },
      { text: "price per pound", confidence: 98 }
    ]
  };

  assert.equal(extractItemName(data), "ORGANIC CHICKEN BREAST");
});
