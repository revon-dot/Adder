import { filterImageFiles, formatOutputFileName } from "./image-processing.js";

const DEFAULT_MAX_WIDTH = 1100;
const DEFAULT_QUALITY = 0.85;

const OUTPUT_MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível converter a imagem."));
      },
      mimeType,
      mimeType === "image/png" ? undefined : quality,
    );
  });
}

function extensionFromName(name = "") {
  const clean = String(name || "").trim();
  const index = clean.lastIndexOf(".");
  if (index <= 0 || index === clean.length - 1) return "jpg";
  const extension = clean.slice(index + 1).toLowerCase();
  return extension === "jpeg" ? "jpg" : extension;
}

function outputMimeType(file) {
  const extension = extensionFromName(file?.name);
  return OUTPUT_MIME_BY_EXTENSION[extension] || file?.type || "image/jpeg";
}

function outputExtension(file) {
  const mimeType = outputMimeType(file);
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function resizeImageKeepingFormat(file, options = {}) {
  const maxWidth = Number(options.maxWidth) || DEFAULT_MAX_WIDTH;
  const quality = Number.isFinite(Number(options.quality)) ? Number(options.quality) : DEFAULT_QUALITY;
  const originalDataUrl = await readAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error(`Imagem inválida: ${file.name}`);
  }

  const scale = originalWidth > maxWidth ? maxWidth / originalWidth : 1;
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas não disponível neste navegador.");

  const mimeType = outputMimeType(file);
  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  const base64DataUrl = await readAsDataUrl(blob);

  return {
    originalName: file.name,
    originalSize: file.size,
    originalWidth,
    originalHeight,
    width,
    height,
    size: blob.size,
    blob,
    base64DataUrl,
    mimeType,
    extension: outputExtension(file),
  };
}

export async function resizeImagesKeepingFormat(files = [], options = {}) {
  const images = filterImageFiles(files);
  const total = images.length;
  const processed = [];

  for (let index = 0; index < images.length; index += 1) {
    const file = images[index];
    options.onProgress?.({ index, total, file, fileName: file.name, relativePath: file.webkitRelativePath || "" });
    const result = await resizeImageKeepingFormat(file, options);
    processed.push({
      ...result,
      index,
      fileName: formatOutputFileName(index, total, result.extension),
    });
  }

  return processed;
}
