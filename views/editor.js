import { state } from "../state.js";
import { render } from "../ui.js";
import { githubPath } from "../github.js";
import { emptyManifest, emptyChapter, normalizeManifest } from "../cubari.js";
import { collectManifestFromEditor, getNextChapterNumber } from "../editor-collector.js";
import { copyText } from "../clipboard.js";
import { showJsonModal } from "../modals.js";
import { saveCurrentEditor } from "./editor-save.js";
import { bindChapterButtons } from "./editor-events.js";
import { updateEditorStats } from "./editor-stats.js";
import { renderEditorPage } from "./editor-page.js";
import { showChapterEditModal } from "./chapter-modal.js";

function editorSnapshot(fileName, manifest) {
  return JSON.stringify({
    fileName: String(fileName || ""),
    manifest: normalizeManifest(manifest || emptyManifest()),
  });
}

function getCurrentEditorSnapshot() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return "";
  return editorSnapshot(result.fileName, result.manifest);
}

function hasUnsavedChanges() {
  if (!state.current?.savedSnapshot) return false;
  return getCurrentEditorSnapshot() !== state.current.savedSnapshot;
}

function confirmLeaveEditor() {
  if (!hasUnsavedChanges()) return true;
  return confirm("Você tem alterações não salvas. Sair mesmo assim?");
}

function bindCopyButton(selector, dataKey) {
  document.querySelector(selector)?.addEventListener("click", (event) => {
    const value = event.currentTarget.dataset[dataKey];
    if (value) copyText(value);
  });
}

function chapterEventOptions(navigateToDashboard) {
  return {
    updateEditorStats,
    renderEditor,
    navigateToDashboard,
  };
}

function addChapterWithDrawer(navigateToDashboard) {
  showChapterEditModal({
    mode: "create",
    number: getNextChapterNumber(),
    chapter: emptyChapter(),
    onSave: ({ number, chapter }) => {
      if (!state.current.data.chapters) state.current.data.chapters = {};
      if (state.current.data.chapters[number]) {
        const ok = confirm(`Já existe um capítulo ${number}. Substituir?`);
        if (!ok) return;
      }
      state.current.data.chapters[number] = chapter;
      renderEditor(navigateToDashboard);
    },
  });
}

export function openEditor(file, navigateToDashboard) {
  if (!file) {
    const data = emptyManifest();
    const name = "novo-manga.json";
    state.current = {
      isNew: true,
      name,
      path: githubPath.joinPath(state.config.jsonPath, name),
      sha: null,
      data,
      savedSnapshot: editorSnapshot(name, data),
    };
  } else {
    const data = structuredClone(file.data);
    state.current = {
      isNew: false,
      name: file.name,
      path: file.path,
      sha: file.sha,
      data,
      htmlUrl: file.htmlUrl,
      downloadUrl: file.downloadUrl,
      savedSnapshot: editorSnapshot(file.name, data),
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
  document.querySelector("#back-dashboard-btn")?.addEventListener("click", () => {
    if (confirmLeaveEditor()) navigateToDashboard();
  });

  window.onbeforeunload = hasUnsavedChanges()
    ? (event) => {
        event.preventDefault();
        event.returnValue = "";
      }
    : null;

  bindCopyButton("#copy-editor-cubari-btn", "cubariUrl");
  bindCopyButton("#copy-editor-raw-btn", "rawUrl");

  document.querySelector("#save-btn")?.addEventListener("click", () => saveCurrentEditor(navigateToDashboard, renderEditor, editorSnapshot));
  document.querySelector("#preview-json-btn")?.addEventListener("click", () => {
    const result = collectManifestFromEditor();
    if (result) showJsonModal(result.manifest, result.validation);
  });
  document.querySelector("#add-chapter-btn")?.addEventListener("click", () => addChapterWithDrawer(navigateToDashboard));

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", () => updateEditorStats({ skipCoverPreview: true }));

  bindChapterButtons(document, chapterEventOptions(navigateToDashboard));
  updateEditorStats();
}
