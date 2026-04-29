import { sanitizeFileName, validateManifest, normalizeManifest } from "./cubari.js";
import { toast } from "./ui.js";

export function collectManifestFromEditor(options = {}) {
  const form = document.querySelector("#editor-form");
  if (!form) return null;

  const formData = new FormData(form);
  const manifest = normalizeManifest({
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || ""),
    artist: String(formData.get("artist") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    cover: String(formData.get("cover") || "").trim(),
    chapters: {},
  });

  const chapterCards = [...document.querySelectorAll("[data-chapter-card]")];
  const duplicateNumbers = new Set();
  const seen = new Set();

  for (const card of chapterCards) {
    const number = card.querySelector("[data-chapter-number]")?.value.trim();
    if (!number) continue;
    if (seen.has(number)) duplicateNumbers.add(number);
    seen.add(number);

    const chapter = {
      title: card.querySelector("[data-chapter-title]")?.value || "",
      volume: card.querySelector("[data-chapter-volume]")?.value || "",
      last_updated: card.querySelector("[data-chapter-updated]")?.value || String(Math.floor(Date.now() / 1000)),
      groups: {},
    };

    const groupCards = [...card.querySelectorAll("[data-group-card]")];
    for (const groupCard of groupCards) {
      const groupName = groupCard.querySelector("[data-group-name]")?.value.trim() || "";
      const imagesText = groupCard.querySelector("[data-group-images]")?.value || "";
      const images = imagesText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      chapter.groups[groupName] = images;
    }

    if (!Object.keys(chapter.groups).length) chapter.groups[""] = [];
    manifest.chapters[number] = chapter;
  }

  const fileName = String(formData.get("fileName") || "").trim() || sanitizeFileName(manifest.title);
  const errors = [];
  if (duplicateNumbers.size) {
    errors.push(`Há capítulos duplicados: ${[...duplicateNumbers].join(", ")}.`);
  }

  const validation = validateManifest(manifest, fileName);
  validation.errors.unshift(...errors);

  if (!options.silent && validation.errors.length) {
    toast(validation.errors[0], "error");
  }

  return {
    manifest,
    fileName,
    validation,
  };
}

export function getNextChapterNumber() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return "1";
  const { manifest } = result;
  const numbers = Object.keys(manifest.chapters || {})
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  return numbers.length ? String(Math.max(...numbers) + 1) : "1";
}
