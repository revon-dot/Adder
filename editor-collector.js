import { sanitizeFileName, validateManifest, normalizeManifest } from "./cubari.js";
import { state } from "./state.js";
import { toast } from "./ui.js";

export function collectManifestFromEditor(options = {}) {
  const form = document.querySelector("#editor-form");
  if (!form) return null;

  const formData = new FormData(form);
  const currentChapters = state.current?.data?.chapters || {};
  const manifest = normalizeManifest({
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || ""),
    artist: String(formData.get("artist") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    cover: String(formData.get("cover") || "").trim(),
    chapters: currentChapters,
  });

  const fileName = String(formData.get("fileName") || "").trim() || sanitizeFileName(manifest.title);
  const validation = validateManifest(manifest, fileName);

  if (!options.silent && validation.errors.length) {
    toast(validation.errors[0], "error");
  }

  return {
    manifest,
    fileName,
    validation,
  };
}

function chapterBaseNumber(value = "") {
  const number = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? Math.floor(number) : null;
}

export function getNextChapterNumber() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return "1";
  const { manifest } = result;
  const numbers = Object.keys(manifest.chapters || {})
    .map(chapterBaseNumber)
    .filter(Number.isFinite);
  return numbers.length ? String(Math.max(...numbers) + 1) : "1";
}
