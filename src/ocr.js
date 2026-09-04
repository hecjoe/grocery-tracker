import { createWorker, PSM } from "tesseract.js";
import "jimp/browser/lib/jimp.js";
import {
  extractItemName,
  findPriceCandidates,
  selectLargestPrice,
  summarizeCandidates
} from "./ocr-parsing.js";

const Jimp = globalThis.Jimp;
const MAX_IMAGE_DIMENSION = 1800;
const MIN_IMAGE_DIMENSION = 1500;

let previewUrl;
let processedPreviewUrl;
let ocrWorkerPromise;
let currentOcrPass = "OCR";
let isScanning = false;

function updateOcrProgress(message) {
  if (typeof message.progress !== "number") return;
  const percent = Math.round(message.progress * 100);
  document.getElementById("scanStatus").textContent =
    `${currentOcrPass}: ${message.status} ${percent}%`;
}

async function createConfiguredWorker() {
  const worker = await createWorker("eng", 1, {
    workerPath: "./tesseract/worker.min.js",
    corePath: "./tesseract/core/tesseract-core-lstm.wasm.js",
    langPath: "./tesseract/lang",
    logger: updateOcrProgress
  });
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: "1"
  });
  return worker;
}

function getOcrWorker() {
  if (!ocrWorkerPromise) ocrWorkerPromise = createConfiguredWorker();
  return ocrWorkerPromise;
}

function discardOcrWorker() {
  const failedWorker = ocrWorkerPromise;
  ocrWorkerPromise = undefined;
  if (failedWorker) {
    failedWorker.then(worker => worker.terminate()).catch(() => {});
  }
}

async function normalizeImageForBrowser(file) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Safari could not decode the selected image."));
      element.src = sourceUrl;
    });

    const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const targetLongestSide = Math.min(
      MAX_IMAGE_DIMENSION,
      Math.max(MIN_IMAGE_DIMENSION, longestSide)
    );
    const scale = targetLongestSide / longestSide;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not create an image canvas.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const normalizedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Could not prepare the captured image.")),
        "image/jpeg",
        0.92
      );
    });
    canvas.width = 1;
    canvas.height = 1;
    return normalizedBlob;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function preprocessWithJimp(imageBlob) {
  if (!Jimp?.read) throw new Error("Jimp did not load in this browser.");
  const image = await Jimp.read(await imageBlob.arrayBuffer());
  image.greyscale().contrast(0.25).quality(90);
  const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
  return new Blob([buffer], { type: "image/jpeg" });
}

function openCameraGuide() {
  const guide = document.getElementById("cameraGuide");
  guide.hidden = false;
  document.getElementById("openCameraButton").focus();
}

function closeCameraGuide({ restoreFocus = true } = {}) {
  document.getElementById("cameraGuide").hidden = true;
  if (restoreFocus) document.getElementById("scanButton").focus();
}

function startCameraCapture() {
  closeCameraGuide({ restoreFocus: false });
  document.getElementById("cameraInput").click();
}

function setPreview(elementId, blob, previousUrl) {
  if (previousUrl) URL.revokeObjectURL(previousUrl);
  const nextUrl = URL.createObjectURL(blob);
  const preview = document.getElementById(elementId);
  preview.src = nextUrl;
  preview.hidden = false;
  return nextUrl;
}

function applyScanToForm(originalData, processedData) {
  const originalPrices = findPriceCandidates(originalData, "original");
  const processedPrices = findPriceCandidates(processedData, "preprocessed");
  const selectedPrice = selectLargestPrice(originalPrices, processedPrices);

  const possibleNames = [extractItemName(processedData), extractItemName(originalData)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const itemName = possibleNames[0] || "";

  const nameInput = document.getElementById("newItemName");
  const priceInput = document.getElementById("newItemPrice");
  nameInput.value = itemName;
  priceInput.value = selectedPrice ? selectedPrice.value.toFixed(2) : "";

  const allPrices = [...originalPrices, ...processedPrices];
  document.getElementById("ocrParseOutput").textContent = summarizeCandidates(allPrices);

  const review = document.getElementById("scanReview");
  const reviewMessage = document.getElementById("scanReviewMessage");
  review.hidden = false;

  if (itemName && selectedPrice) {
    reviewMessage.textContent =
      `Largest price text found: $${selectedPrice.value.toFixed(2)}. Correct either field, then tap Add.`;
  } else if (!itemName && !selectedPrice) {
    reviewMessage.textContent = "No reliable name or price was found. Enter both fields manually, then tap Add.";
  } else if (!itemName) {
    reviewMessage.textContent = "Price found, but the item name needs to be entered manually.";
  } else {
    reviewMessage.textContent = "Item name found, but the price needs to be entered manually.";
  }

  if (typeof window.validateInput === "function") window.validateInput();
  (itemName ? priceInput : nameInput).focus();

  return { itemName, selectedPrice, candidates: allPrices };
}

async function processScan(event) {
  const input = event.currentTarget || event.target;
  const file = input.files?.[0];
  if (!file || isScanning) return null;

  const scanButton = document.getElementById("scanButton");
  const scanStatus = document.getElementById("scanStatus");
  const debugPanel = document.getElementById("ocrDebug");
  const rawOutput = document.getElementById("ocrRawText");
  const processedOutput = document.getElementById("ocrProcessedText");
  const parseOutput = document.getElementById("ocrParseOutput");

  isScanning = true;
  scanButton.disabled = true;
  scanButton.setAttribute("aria-busy", "true");
  scanButton.textContent = "…";
  scanStatus.textContent = "Preparing image…";
  rawOutput.textContent = "";
  processedOutput.textContent = "";
  parseOutput.textContent = "";
  debugPanel.hidden = false;
  debugPanel.open = false;
  document.getElementById("scanReview").hidden = true;
  previewUrl = setPreview("scanPreview", file, previewUrl);

  let originalData;
  let processedData;

  try {
    const normalizedImage = await normalizeImageForBrowser(file);
    const worker = await getOcrWorker();

    currentOcrPass = "Original image";
    const originalResult = await worker.recognize(normalizedImage);
    originalData = originalResult.data;
    rawOutput.textContent = originalData.text || "No text detected.";
    console.log("Tesseract result (original):", originalData);

    try {
      scanStatus.textContent = "Applying Jimp grayscale and contrast…";
      const processedImage = await preprocessWithJimp(normalizedImage);
      processedPreviewUrl = setPreview("processedPreview", processedImage, processedPreviewUrl);

      currentOcrPass = "Preprocessed image";
      const processedResult = await worker.recognize(processedImage);
      processedData = processedResult.data;
      processedOutput.textContent = processedData.text || "No text detected.";
      console.log("Tesseract result (Jimp preprocessed):", processedData);
    } catch (preprocessError) {
      console.error("Jimp/preprocessed OCR pass failed; using original OCR:", preprocessError);
      processedOutput.textContent =
        `Preprocessed pass failed; original OCR was kept.\n${preprocessError?.message || preprocessError}`;
      discardOcrWorker();
    }

    const extracted = applyScanToForm(originalData, processedData);
    debugPanel.open = true;
    scanStatus.textContent = extracted.itemName || extracted.selectedPrice
      ? "Scan complete. Review the fields before adding."
      : "OCR finished, but nothing reliable was parsed. Enter the fields manually.";
    return { original: originalData, processed: processedData, extracted };
  } catch (error) {
    console.error("Tesseract OCR failed:", error);
    rawOutput.textContent = `OCR failed.\n${error?.message || error}`;
    debugPanel.open = true;
    scanStatus.textContent = "OCR failed. You can still enter the item manually.";
    document.getElementById("scanReview").hidden = false;
    document.getElementById("scanReviewMessage").textContent =
      "The scan could not be read. Enter the item name and price manually.";
    discardOcrWorker();
    return null;
  } finally {
    isScanning = false;
    scanButton.disabled = false;
    scanButton.removeAttribute("aria-busy");
    scanButton.textContent = "📷";
    input.value = "";
  }
}

window.openCameraGuide = openCameraGuide;
window.closeCameraGuide = closeCameraGuide;
window.startCameraCapture = startCameraCapture;
window.processScan = processScan;

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !document.getElementById("cameraGuide").hidden) {
    closeCameraGuide();
  }
});

document.getElementById("scanButton").disabled = false;
