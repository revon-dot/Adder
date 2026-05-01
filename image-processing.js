const DEFAULT_MAX_WIDTH = 1100;
const DEFAULT_JPEG_QUALITY = 0.85;
const DEFAULT_OUTPUT_EXTENSION = "jpg";
const DEFAULT_OUTPUT_MIME_TYPE = "image/jpeg";

function toArray(files = []) {
  return Array.from(files || []);
}

function isImageFile(file) {
  return file instanceof File && file.type.startsWith("image/");
}

function padPageNumber(index, total) {
  const width = Math.max(3, String(total).length);
  return String(index + 1).padStart(width, "0");
}

function sortByName(files = []) {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" }));
}

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
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Não foi possível converter a imagem."));
        }
      },
      mimeType,
      quality,
    );
  });
}

async function blobToBase64(blob) {
  return readAsDataUrl(blob);
}

export function filterImageFiles(files = []) {
  return sortByName(toArray(files).filter(isImageFile));
}

export function formatOutputFileName(index, total, extension = DEFAULT_OUTPUT_EXTENSION) {
  const cleanExtension = String(extension || DEFAULT_OUTPUT_EXTENSION).replace(/^\.+/, "") || DEFAULT_OUTPUT_EXTENSION;
  return `${padPageNumber(index, total)}.${cleanExtension}`;
}

export async function processImageFile(file, options = {}) {
  const maxWidth = Number(options.maxWidth) || DEFAULT_MAX_WIDTH;
  const quality = Number.isFinite(Number(options.quality)) ? Number(options.quality) : DEFAULT_JPEG_QUALITY;
  const mimeType = options.mimeType || DEFAULT_OUTPUT_MIME_TYPE;

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

  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, mimeType, quality);
  const base64DataUrl = await blobToBase64(blob);

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
  };
}

export async function processImageFiles(files = [], options = {}) {
  const images = filterImageFiles(files);
  const total = images.length;
  const extension = options.extension || DEFAULT_OUTPUT_EXTENSION;
  const processed = [];

  for (let index = 0; index < images.length; index += 1) {
    const file = images[index];
    options.onProgress?.({
      phase: "processing",
      index,
      total,
      file,
    });

    const result = await processImageFile(file, options);
    processed.push({
      ...result,
      index,
      fileName: formatOutputFileName(index, total, extension),
    });
  }

  return processed;
}

export function sumBytes(items = [], key = "size") {
  return items.reduce((total, item) => total + (Number(item?.[key]) || 0), 0);
}

export function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export const imageProcessingDefaults = {
  maxWidth: DEFAULT_MAX_WIDTH,
  quality: DEFAULT_JPEG_QUALITY,
  extension: DEFAULT_OUTPUT_EXTENSION,
  mimeType: DEFAULT_OUTPUT_MIME_TYPE,
};
