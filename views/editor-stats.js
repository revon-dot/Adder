import { countGroups, countImages, normalizeManifest } from "../cubari.js";
import { state } from "../state.js";

export function updateEditorStats() {
  const manifest = normalizeManifest(state.current?.data || {});
  const chapters = Object.keys(manifest.chapters || {}).length;
  const groups = countGroups(manifest);
  const images = countImages(manifest);

  const statChapters = document.querySelector("#stat-chapters");
  const statGroups = document.querySelector("#stat-groups");
  const statImages = document.querySelector("#stat-images");
  if (statChapters) statChapters.textContent = String(chapters);
  if (statGroups) statGroups.textContent = String(groups);
  if (statImages) statImages.textContent = String(images);
}
