import { attr } from "../utils.js";
import { countGroups, countImages } from "../cubari.js";
import { collectManifestFromEditor } from "../editor-collector.js";

export function updateEditorStats() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return;
  const { manifest } = result;
  const chapters = Object.keys(manifest.chapters || {}).length;
  const groups = countGroups(manifest);
  const images = countImages(manifest);

  const statChapters = document.querySelector("#stat-chapters");
  const statGroups = document.querySelector("#stat-groups");
  const statImages = document.querySelector("#stat-images");
  if (statChapters) statChapters.textContent = String(chapters);
  if (statGroups) statGroups.textContent = String(groups);
  if (statImages) statImages.textContent = String(images);

  const coverValue = document.querySelector("input[name='cover']")?.value.trim();
  const preview = document.querySelector("#preview-cover");
  if (preview) {
    preview.innerHTML = coverValue
      ? `<img src="${attr(coverValue)}" alt="Capa" onerror="this.parentElement.innerHTML='<div class=&quot;cover-placeholder&quot;>Sem capa</div>'" />`
      : `<div class="cover-placeholder">Sem capa</div>`;
  }
}
