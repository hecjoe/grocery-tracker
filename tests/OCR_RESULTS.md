# Costco OCR regression results

Expected values for all nine original images were visually read and confirmed by the user before assertions were written. Every run below performed fresh Tesseract.js 5.1.1 OCR and tested the actual `processScan()` source; the expected strings were never changed to accommodate OCR errors.

Runtime: Node.js 22.23.2 on Windows. Browser Canvas is adapted with `@napi-rs/canvas`; original images are decoded to PNG using `sharp`. No product lookup tables or fixture-specific production branches are used.

| Run | Pass | Fail |
|---|---:|---:|
| Baseline | 0 | 9 |
| Iteration 1: sparse segmentation | 1 | 8 |
| Iteration 2: automatic segmentation | 0 | 9 |
| Iteration 3: tag and price regions | 3 | 6 |
| Iteration 4: isolated name lines | 4 | 5 |
| Iteration 5: word confidence comparison | 8 | 1 |
| Iteration 6: preserve complete words | 9 | 0 |

## Baseline

Tested function SHA-256: `d2465527515143442b07a44bb237e4619b1ffcedef07cf53fe1be47045266d7d`.

```text
not ok 1 - 1635077_f520.jpg
  actual: {"name": "EE —————— 285789 Mumm x PHILIPS", "price": "179.97"}
not ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "EEE a ree — = a — We SS Be 706674 Mumm", "price": "706674.00"}
not ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "1186666 MAL k ARTIKA \"METTLE\" LED WALL SCONCE ~~", "price": "39.99"}
not ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "| AMARA ORGANIC | YOGURT SMOOTHIE MELTS | 4/1 OZ |", "price": ""}
not ok 5 - costco-price.jpg
  actual: {"name": "DIXIE 10 1/16\" PLATE 186 COUNT PACKAGE", "price": "9.00"}
not ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "1312504 NIE *", "price": "39.97"}
not ok 7 - images.jpg
  actual: {"name": "a x — A ___A__ —. ”", "price": "14.99"}
not ok 8 - l-intro-1749651121.jpg
  actual: {"name": "— i - ¢ 3 a>", "price": "17.89"}
not ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT A195-CCT6 PACK", "price": "0.00"}
# tests 9
# pass 0
# fail 9
```

Full TAP output: `tests/results/baseline.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/baseline/` (local, Git-ignored).

## Iteration 1: sparse segmentation

Tested function SHA-256: `434cf3cbdd9b5e7afa7b9b5de53eb1d629eb9024f0e6afc3840df00ea8487e49`.

```text
not ok 1 - 1635077_f520.jpg
  actual: {"name": "[TTT", "price": "179.97"}
not ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "-— a ae", "price": "18.00"}
not ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "EER EEE (TTT", "price": "39.99"}
not ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "oe AMARA YOGURT SMOOTHIE MELTS", "price": "13.00"}
not ok 5 - costco-price.jpg
  actual: {"name": "—— mi a  —  ———p—— I", "price": "20.90"}
not ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "——", "price": "39.97"}
not ok 7 - images.jpg
  actual: {"name": "Fa ——", "price": "14.99"}
not ok 8 - l-intro-1749651121.jpg
  actual: {"name": "— — - = y", "price": "123951.00"}
ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT A19 5-CCT 6 PACK", "price": "9.99"}
# tests 9
# pass 1
# fail 8
```

Full TAP output: `tests/results/iteration-1.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-1/` (local, Git-ignored).

## Iteration 2: automatic segmentation

Tested function SHA-256: `6d33bcceeb344299b01ed7b485048c23fabc366ac6110dabf0c5f0cb8469bae5`.

```text
not ok 1 - 1635077_f520.jpg
  actual: {"name": "285789 Mummy x PHILIPS HOME THEATER SYSTEM", "price": "285789.00"}
not ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "706674 Mum IRIS STACKABLE STORAGE SET", "price": "706674.00"}
not ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "I 1186666 Amu x ARTIKA \"METTLE\"", "price": "39.99"}
not ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "ARR: ‘ORGA} YOGURT SMOOTHIE MELTS 4/1 OZ", "price": ""}
not ok 5 - costco-price.jpg
  actual: {"name": "10 1/16\" PLATE 186 COUNT PACKAGE", "price": "20.99"}
not ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "| 14] | HOLMES [S woums | WORKWEAR. |", "price": ""}
not ok 7 - images.jpg
  actual: {"name": "32 DEGREE MEN'S FULL ZIP VEST", "price": "32.00"}
not ok 8 - l-intro-1749651121.jpg
  actual: {"name": "wn mS. i t { - [2] - E— -", "price": ""}
not ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT ® Energy Star Approved", "price": "800.00"}
# tests 9
# pass 0
# fail 9
```

Full TAP output: `tests/results/iteration-2.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-2/` (local, Git-ignored).

## Iteration 3: tag and price regions

Tested function SHA-256: `53cca0b2df31958dcf67497240444b0663c59b34dbdbd2a3aaaf384a10626180`.

```text
ok 1 - 1635077_f520.jpg
  actual: {"name": "PHILIPS HOME THEATER SYSTEM DVD/CD HTS3566D/37", "price": "179.97"}
not ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "RIS IRIS STACKABLE STORAGE SET", "price": "18.69"}
not ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "A 1 OVUUUYV ARTIKA \"METTLE\" LED WALL SCONCE", "price": "39.99"}
not ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "AMARA YOGURT SMOOTHIE MELTS 4/1 OZ", "price": "13.99"}
ok 5 - costco-price.jpg
  actual: {"name": "DIXIE 10 1/16\" PLATE 186 COUNT PACKAGE", "price": "20.99"}
not ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "HOT MES HI-VIS WORKWEAR RAINSUIT", "price": "39.97"}
ok 7 - images.jpg
  actual: {"name": "32 DEGREE MEN'S FULL ZIP VEST", "price": "11.99"}
not ok 8 - l-intro-1749651121.jpg
  actual: {"name": "KIRKLAND SIGNATURE FREE CLEAR LIQUID HE 146 LOADS 194 OZ", "price": "13.99"}
not ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT ALY J- CCT 6 PACK", "price": "9.99"}
# tests 9
# pass 3
# fail 6
```

Full TAP output: `tests/results/iteration-3.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-3/` (local, Git-ignored).

## Iteration 4: isolated name lines

Tested function SHA-256: `c0e7b877d4bbc8efbe004f3f3721921428b934712608abcd8bf80e9deece1c7d`.

```text
ok 1 - 1635077_f520.jpg
  actual: {"name": "PHILIPS HOME THEATER SYSTEM DVD/CD HTS3566D/37", "price": "179.97"}
not ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "IRIS STACKABLE STORAGE SET 13 OUART 8 PACK", "price": "18.69"}
not ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "ARTIKA \"METTLE\" LED WALL SCONCE 2 INDOOR/OUTDOOR", "price": "39.99"}
not ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "AMARA ORGANIST YOGURT SMOOTHIE MELTS 4/1 OZ", "price": "13.99"}
ok 5 - costco-price.jpg
  actual: {"name": "DIXIE 10 1/16\" PLATE 186 COUNT PACKAGE", "price": "20.99"}
ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "HOLMES HI-VIS WORKWEAR RAINSUIT", "price": "39.97"}
ok 7 - images.jpg
  actual: {"name": "32 DEGREE MEN'S FULL ZIP VEST", "price": "11.99"}
not ok 8 - l-intro-1749651121.jpg
  actual: {"name": "KIRKLAND SIGNATURE FREE & CLEAR LIOUID HE 146 LOADS / 194 O77.", "price": "13.99"}
not ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC 1 ED 60W REPLACEMENT A19 5-CCT 6 PACK", "price": "9.99"}
# tests 9
# pass 4
# fail 5
```

Full TAP output: `tests/results/iteration-4.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-4/` (local, Git-ignored).

## Iteration 5: word confidence comparison

Tested function SHA-256: `2aa41419037d32fa132bc45061962cc2126490971ac0c48669ca4eb8472600fb`.

```text
ok 1 - 1635077_f520.jpg
  actual: {"name": "PHILIPS HOME THEATER SYSTEM DVD/CD HTS3566D/37", "price": "179.97"}
ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "IRIS STACKABLE STORAGE SET 13 QUART 8 PACK", "price": "18.69"}
ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "ARTIKA \"METTLE\" LED WALL SCONCE INDOOR/OUTDOOR", "price": "39.99"}
ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "AMARA ORGANIC YOGURT SMOOTHIE MELTS 4/1 OZ", "price": "13.99"}
ok 5 - costco-price.jpg
  actual: {"name": "DIXIE 10 1/16\" PLATE 186 COUNT PACKAGE", "price": "20.99"}
ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "HOLMES HI-VIS WORKWEAR RAINSUIT", "price": "39.97"}
ok 7 - images.jpg
  actual: {"name": "32 DEGREE MEN'S FULL ZIP VEST", "price": "11.99"}
ok 8 - l-intro-1749651121.jpg
  actual: {"name": "KIRKLAND SIGNATURE FREE & CLEAR LIQUID HE 146 LOADS / 194 OZ", "price": "13.99"}
not ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT A19 CCT 6 PACK", "price": "9.99"}
# tests 9
# pass 8
# fail 1
```

Full TAP output: `tests/results/iteration-5.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-5/` (local, Git-ignored).

## Iteration 6: preserve complete words

Tested function SHA-256: `57906e20b2c8328d4c95a7fad525342f1e86346f71c809e083bf2f18ab68a5aa`.

```text
ok 1 - 1635077_f520.jpg
  actual: {"name": "PHILIPS HOME THEATER SYSTEM DVD/CD HTS3566D/37", "price": "179.97"}
ok 2 - 635254874259005563_fdaa4629e7.webp
  actual: {"name": "IRIS STACKABLE STORAGE SET 13 QUART 8 PACK", "price": "18.69"}
ok 3 - asterisks-on-price-tags-mean-you-probably-wont-see-them-again-1697040470.jpg
  actual: {"name": "ARTIKA \"METTLE\" LED WALL SCONCE INDOOR/OUTDOOR", "price": "39.99"}
ok 4 - Costco-Price-Tag.original.webp
  actual: {"name": "AMARA ORGANIC YOGURT SMOOTHIE MELTS 4/1 OZ", "price": "13.99"}
ok 5 - costco-price.jpg
  actual: {"name": "DIXIE 10 1/16\" PLATE 186 COUNT PACKAGE", "price": "20.99"}
ok 6 - if-the-price-ends-in-97-youre-getting-a-solid-discount-1697040470.jpg
  actual: {"name": "HOLMES HI-VIS WORKWEAR RAINSUIT", "price": "39.97"}
ok 7 - images.jpg
  actual: {"name": "32 DEGREE MEN'S FULL ZIP VEST", "price": "11.99"}
ok 8 - l-intro-1749651121.jpg
  actual: {"name": "KIRKLAND SIGNATURE FREE & CLEAR LIQUID HE 146 LOADS / 194 OZ", "price": "13.99"}
ok 9 - topur3eeqf2c1.jpg
  actual: {"name": "FEIT ELECTRIC LED 60W REPLACEMENT A19 5-CCT 6 PACK", "price": "9.99"}
# tests 9
# pass 9
# fail 0
```

Full TAP output: `tests/results/iteration-6.log`. Raw text, word boxes, confidences, and source snapshot: `tests/results/iteration-6/` (local, Git-ignored).

## Limits

These nine fixtures now pass exact name and price assertions. This does not establish accuracy on unseen tags or performance on a phone. The image processing assumes a pale tag with its product name near the top and largest sell-price digits in the lower half. Multiple OCR passes improve these fixtures at the cost of scan time.
