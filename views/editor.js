import { state } from "../state.js";
import { render } from "../ui.js";
import { githubPath } from "../github.js";
import { emptyManifest, emptyChapter, normalizeManifest, sanitizeFileName } from "../cubari.js";
import { collectManifestFromEditor, getNextChapterNumber } from "../editor-collector.js";
import { copyText } from "../clipboard.js";
import { saveCurrentEditor } from "./editor-save.js";
import { bindChapterButtons } from "./editor-events.js";
import { updateEditorStats } from "./editor-stats.js";
import { renderEditorPage } from "./editor-page.js";
import { showChapterEditModal } from "./chapter-modal.js";
import { bindLanguageToggle, t } from "../i18n.js";
import { ensureClient } from "../repo.js";
import { setBusy, toast, errorMessage } from "../ui.js";

function editorSnapshot(fileName, manifest) {
  return JSON.stringify({
    fileName: String(fileName || ""),
    manifest: normalizeManifest(manifest || emptyManifest()),
  });
}

function syncAutoFileName() {
  if (!state.current?.isNew) return;
  const titleInput = document.querySelector("input[name='title']");
  const fileNameInput = document.querySelector("input[name='fileName']");
  if (!titleInput || !fileNameInput) return;
  fileNameInput.value = sanitizeFileName(titleInput.value);
}

function syncCurrentFromForm() {
  syncAutoFileName();
  const result = collectManifestFromEditor({ silent: true });
  if (!result || !state.current) return null;
  state.current.data = result.manifest;
  state.current.name = result.fileName;
  state.current.path = githubPath.joinPath(state.config.jsonPath, result.fileName);
  return result;
}

function getCurrentEditorSnapshot() {
  const result = syncCurrentFromForm();
  if (!result) return "";
  return editorSnapshot(result.fileName, result.manifest);
}

function hasUnsavedChanges() {
  if (!state.current?.savedSnapshot) return false;
  return getCurrentEditorSnapshot() !== state.current.savedSnapshot;
}

function confirmLeaveEditor() {
  if (!hasUnsavedChanges()) return true;
  return confirm(t("savedChangesWarning"));
}

function goToDashboard(navigateToDashboard) {
  if (confirmLeaveEditor()) navigateToDashboard();
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
  syncCurrentFromForm();
  showChapterEditModal({
    mode: "create",
    number: getNextChapterNumber(),
    chapter: emptyChapter(),
    onSave: ({ number, chapter }) => {
      syncCurrentFromForm();
      if (!state.current.data.chapters) state.current.data.chapters = {};
      if (state.current.data.chapters[number]) {
        const ok = confirm(t("replaceExistingChapter", { number }));
        if (!ok) return;
      }
      state.current.data.chapters[number] = chapter;
      renderEditor(navigateToDashboard);
    },
  });
}

async function deleteCurrentWork(navigateToDashboard) {
  if (!state.current || state.current.isNew || !state.current.path || !state.current.sha) return;
  const ok = confirm(t("deleteWorkConfirm", { name: state.current.name || state.current.path }));
  if (!ok) return;

  try {
    setBusy(true);
    const client = ensureClient();
    await client.deleteFile({
      ...state.config,
      path: state.current.path,
      sha: state.current.sha,
      message: `Delete ${state.current.name} via Adder Pages`,
    });
    state.files = state.files.filter((file) => file.path !== state.current.path);
    state.current = null;
    toast(t("workDeleted"), "success");
    navigateToDashboard();
  } catch (error) {
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}

export function openEditor(file, navigateToDashboard) {
  if (!file) {
    const data = emptyManifest();
    const name = sanitizeFileName(data.title);
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
  bindLanguageToggle(() => {
    syncCurrentFromForm();
    renderEditor(navigateToDashboard);
  });
  document.querySelector("#logo-dashboard-btn")?.addEventListener("click", () => goToDashboard(navigateToDashboard));

  window.onbeforeunload = hasUnsavedChanges()
    ? (event) => {
        event.preventDefault();
        event.returnValue = "";
      }
    : null;

  bindCopyButton("#copy-editor-cubari-btn", "cubariUrl");
  document.querySelector("#delete-work-btn")?.addEventListener("click", () => deleteCurrentWork(navigateToDashboard));

  document.querySelector("#save-btn")?.addEventListener("click", () => {
    syncAutoFileName();
    saveCurrentEditor(navigateToDashboard, renderEditor, editorSnapshot);
  });
  document.querySelector("#add-chapter-btn")?.addEventListener("click", () => addChapterWithDrawer(navigateToDashboard));

  const titleInput = document.querySelector("input[name='title']");
  titleInput?.addEventListener("input", () => {
    syncAutoFileName();
    updateEditorStats({ skipCoverPreview: true });
  });

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", () => updateEditorStats({ skipCoverPreview: true }));

  bindChapterButtons(document, chapterEventOptions(navigateToDashboard));
  syncAutoFileName();
  updateEditorStats();
}
