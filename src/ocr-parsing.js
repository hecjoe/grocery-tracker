const ITEM_NUMBER_LINE = /^\s*\d{6,8}\b/;
const TITLE_METADATA = /\b(?:PRICE\s+PER|PRICE\s+AT\s+REGISTER|MFR'?S\s+INSTANT\s+REBATE|SIZES?|SELL\s+PRICE|UNIT\s+PRICE|INSTANT\s+SAVINGS)\b/i;

function getWords(data) {
  if (Array.isArray(data?.words)) return data.words;

  return (data?.blocks || []).flatMap(block =>
    (block.paragraphs || []).flatMap(paragraph =>
      (paragraph.lines || []).flatMap(line => line.words || [])
    )
  );
}

function getLines(data) {
  if (Array.isArray(data?.lines)) return data.lines;

  return (data?.blocks || []).flatMap(block =>
    (block.paragraphs || []).flatMap(paragraph => paragraph.lines || [])
  );
}

function parsePriceToken(text) {
  const compact = String(text || "")
    .trim()
    .replace(/[Oo]/g, "0")
    .replace(/^\$\s*/, "")
    .replace(/^[^\d]+|[^\d.,]+$/g, "");

  let match = compact.match(/^(\d{1,3})[.,](\d{2})$/);
  if (!match) {
    match = compact.match(/^(\d{1,3})(\d{2})$/);
  }
  if (!match) return null;

  const value = Number(`${match[1]}.${match[2]}`);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function findPriceCandidates(data, source = "OCR") {
  return getWords(data).flatMap(word => {
    const value = parsePriceToken(word.text);
    const bbox = word.bbox;
    if (value === null || !bbox) return [];

    const height = Math.max(0, Number(bbox.y1) - Number(bbox.y0));
    if (!Number.isFinite(height) || height <= 0) return [];

    return [{
      value,
      text: word.text,
      height,
      y: Number(bbox.y1) || 0,
      confidence: Number(word.confidence) || 0,
      source
    }];
  });
}

export function selectLargestPrice(...candidateGroups) {
  const candidates = candidateGroups.flat().filter(Boolean);
  candidates.sort((a, b) =>
    b.height - a.height ||
    b.y - a.y ||
    b.confidence - a.confidence ||
    Number(b.source === "preprocessed") - Number(a.source === "preprocessed")
  );
  return candidates[0] || null;
}

function sanitizeTitleLine(text) {
  return String(text || "")
    .replace(/[•*+|]+/g, " ")
    .replace(/\s+\$?\d{1,3}(?:[., ]\d{2}|\d{2})\s*$/g, "")
    .replace(/[^A-Za-z0-9&'’()\-/ ]+/g, " ")
    .replace(/(^|\s)[A-Za-z]{1,2}(?=\s|$)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isTitleLine(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || TITLE_METADATA.test(trimmed)) return false;
  if (/^[•*-]/.test(trimmed) || /^[a-z\d]/.test(trimmed)) return false;

  const letters = trimmed.match(/[A-Za-z]/g) || [];
  const uppercase = trimmed.match(/[A-Z]/g) || [];
  return letters.length >= 3 && uppercase.length / letters.length >= 0.8;
}

export function extractItemName(data) {
  const lines = getLines(data)
    .map(line => ({ text: String(line?.text || "").trim(), confidence: Number(line?.confidence) || 0 }))
    .filter(line => line.text);

  const anchorIndex = lines.findIndex(line => ITEM_NUMBER_LINE.test(line.text));
  if (anchorIndex >= 0) {
    const titleParts = [];
    for (let index = anchorIndex + 1; index < lines.length && titleParts.length < 3; index += 1) {
      const line = lines[index].text;
      if (!isTitleLine(line)) break;
      const cleaned = sanitizeTitleLine(line);
      if (cleaned) titleParts.push(cleaned);
    }
    if (titleParts.length) return titleParts.join(" ");
  }

  const fallback = lines
    .filter(line => isTitleLine(line.text) && !ITEM_NUMBER_LINE.test(line.text))
    .map(line => ({ ...line, cleaned: sanitizeTitleLine(line.text) }))
    .filter(line => line.cleaned)
    .sort((a, b) => {
      const aLetters = (a.cleaned.match(/[A-Za-z]/g) || []).length;
      const bLetters = (b.cleaned.match(/[A-Za-z]/g) || []).length;
      return bLetters - aLetters || b.confidence - a.confidence;
    })[0];

  return fallback?.cleaned || "";
}

export function summarizeCandidates(candidates) {
  if (!candidates.length) return "No price-shaped word boxes found.";
  return candidates
    .slice()
    .sort((a, b) => b.height - a.height || b.y - a.y)
    .map(candidate =>
      `${candidate.source}: ${candidate.text} → $${candidate.value.toFixed(2)} ` +
      `(box ${Math.round(candidate.height)}px high, confidence ${Math.round(candidate.confidence)}%)`
    )
    .join("\n");
}
