import { state } from "../state.js";
import { render } from "../ui.js";
import { githubPath } from "../github.js";
import { emptyManifest, normalizeManifest } from "../cubari.js";
import { collectManifestFromEditor } from "../editor-collector.js";
import { showJsonModal, showAddChapterModal } from "../modals.js";
import { renderChapterCard } from "./editor-renderers.js";
import { saveCurrentEditor } from "./editor-save.js";
import { bindChapterButtons } from "./editor-events.js";
import { updateEditorStats } from "./editor-stats.js";
import { renderEditorPage } from "./editor-page.js";

export function openEditor(file, navigateToDashboard) {
  if (!file) {
    // New manifest
    const data = emptyManifest();
    state.current = {
      isNew: true,
      name: "novo-manga.json",
      path: githubPath.joinPath(state.config.jsonPath, "novo-manga.json"),
      sha: null,
      data,
    };
  } else {
    state.current = {
      isNew: false,
      name: file.name,
      path: file.path,
      sha: file.sha,
      data: structuredClone(file.data),
    };
  }
  renderEditor(navigateToDashboard);
}

export function renderEditor(navigateToDashboard) {
  const current = state.current;
  const manifest = normalizeManifest(current.data || emptyManifest());
  render(renderEditorPage(current, manifest));
  bindEditorEvents(navigateToDashboard);
}

function bindEditorEvents(navigateToDashboard) {
  document.querySelector("#back-dashboard-btn").addEventListener("click", navigateToDashboard);
  document.querySelector("#save-btn").addEventListener("click", () => saveCurrentEditor(navigateToDashboard, renderEditor));
  document.querySelector("#preview-json-btn").addEventListener("click", () => {
    const result = collectManifestFromEditor();
    if (result) showJsonModal(result.manifest);
  });
  document.querySelector("#add-chapter-btn").addEventListener("click", () => showAddChapterModal(renderChapterCard, (scope) => bindChapterButtons(scope, updateEditorStats), updateEditorStats));

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", updateEditorStats);
  document.querySelector("#chapters-list")?.addEventListener("input", updateEditorStats);

  bindChapterButtons(document, updateEditorStats);
  updateEditorStats();
}
