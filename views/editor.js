import { state, resetEditorListState } from "../state.js";
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
import { showMultiChapterUploadModal } from "./multi-chapter-modal.js";
import { showGithubImageUploadModal } from "./github-image-upload-modal.js";
import { showGithubFolderUploadModal } from "./github-folder-upload-modal.js";
import { bindLanguageToggle, t } from "../i18n.js";
import { ensureClient } from "../repo.js";
import { setBusy, toast, errorMessage } from "../ui.js";
import { githubImageDefaults, mangaFolderFromJsonName } from "../github-image-links.js";

function editorSnapshot(fileName, manifest) {
  return JSON.stringify({
    fileName: String(fileName || ""),
    manifest: normalizeManifest(manifest || emptyManifest()),
  });
}

function unsavedUploadJsonWarning() {
  return document.documentElement.lang === "en"
    ? "Images were uploaded, but the JSON is NOT saved yet. Click Save to GitHub."
    : "Imagens enviadas, mas o JSON ainda NÃO foi salvo. Clique em Salvar no GitHub.";
}

function deleteWorkAssetsWarning() {
  return document.documentElement.lang === "en"
    ? "\n\nThe image folder for this work will also be deleted from the repository."
    : "\n\nA pasta de imagens desta obra também será deletada do repositório.";
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

function upsertUploadedChapter({ number, chapter, conflictMode }) {
  if (!state.current.data.chapters) state.current.data.chapters = {};
  const existingChapter = state.current.data.chapters[number];

  if (existingChapter && conflictMode === "merge") {
    state.current.data.chapters[number] = {
      ...existingChapter,
      title: chapter.title || existingChapter.title || "",
      volume: chapter.volume || existingChapter.volume || "",
      last_updated: chapter.last_updated,
      groups: {
        ...(existingChapter.groups || {}),
        ...(chapter.groups || {}),
      },
    };
    return;
  }

  state.current.data.chapters[number] = chapter;
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

function addMultipleChaptersWithDrawer(navigateToDashboard) {
  syncCurrentFromForm();
  showMultiChapterUploadModal({
    onSave: ({ imported }) => {
      syncCurrentFromForm();
      if (!state.current.data.chapters) state.current.data.chapters = {};
      imported.forEach(({ number, chapter }) => {
        state.current.data.chapters[number] = chapter;
      });
      renderEditor(navigateToDashboard);
    },
  });
}

function addGithubImageChapterWithDrawer(navigateToDashboard) {
  syncCurrentFromForm();
  showGithubImageUploadModal({
    onSave: ({ number, chapter, conflictMode }) => {
      syncCurrentFromForm();
      upsertUploadedChapter({ number, chapter, conflictMode });
      renderEditor(navigateToDashboard);
      toast(unsavedUploadJsonWarning(), "warning");
    },
  });
}

function addGithubFolderChaptersWithDrawer(navigateToDashboard) {
  syncCurrentFromForm();
  showGithubFolderUploadModal({
    onSave: ({ imported, conflictMode }) => {
      syncCurrentFromForm();
      imported.forEach(({ number, chapter }) => {
        upsertUploadedChapter({ number, chapter, conflictMode });
      });
      renderEditor(navigateToDashboard);
      toast(unsavedUploadJsonWarning(), "warning");
    },
  });
}

function safeDecodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function extractRepositoryPathFromImageUrl(url) {
  const config = state.config || {};
  let parsed;

  try {
    parsed = new URL(String(url || ""));
  } catch {
    return "";
  }

  const pathParts = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map(safeDecodePathSegment);

  const owner = String(config.owner || "");
  const repo = String(config.repo || "");
  const branchParts = String(config.branch || "main").split("/").filter(Boolean);

  if (parsed.hostname === "raw.githubusercontent.com") {
    const matchesRepo = pathParts[0] === owner && pathParts[1] === repo;
    const matchesBranch = branchParts.every((part, index) => pathParts[index + 2] === part);
    if (!matchesRepo || !matchesBranch) return "";
    return pathParts.slice(2 + branchParts.length).join("/");
  }

  if (parsed.hostname === `${owner}.github.io`) {
    if (pathParts[0] !== repo) return "";
    return pathParts.slice(1).join("/");
  }

  return "";
}

function collectImageFoldersFromManifest() {
  const mangaFolder = mangaFolderFromJsonName(state.current?.name || "");
  if (!mangaFolder) return [];

  const folders = new Set([
    githubPath.joinPath(githubImageDefaults.imagesRoot, mangaFolder),
  ]);

  const addFolderFromRepositoryPath = (path) => {
    const parts = String(path || "").split("/").filter(Boolean);
    const mangaFolderIndex = parts.indexOf(mangaFolder);
    if (mangaFolderIndex <= 0) return;
    folders.add(parts.slice(0, mangaFolderIndex + 1).join("/"));
  };

  Object.values(state.current?.data?.chapters || {}).forEach((chapter) => {
    Object.values(chapter?.groups || {}).forEach((urls) => {
      if (!Array.isArray(urls)) return;
      urls.forEach((url) => {
        const path = extractRepositoryPathFromImageUrl(url);
        addFolderFromRepositoryPath(path);
      });
    });
  });

  return [...folders].filter(Boolean);
}

async function listRepositoryFilesRecursive(client, path) {
  let contents;

  try {
    contents = await client.listContents({
      ...state.config,
      path,
    });
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }

  const items = Array.isArray(contents) ? contents : [contents];
  const files = [];

  for (const item of items) {
    if (item.type === "file") {
      files.push(item);
      continue;
    }

    if (item.type === "dir") {
      const nestedFiles = await listRepositoryFilesRecursive(client, item.path);
      files.push(...nestedFiles);
    }
  }

  return files;
}

async function deleteRepositoryFolderFiles(client, folderPath, workName) {
  const files = await listRepositoryFilesRecursive(client, folderPath);

  for (const file of files) {
    await client.deleteFile({
      ...state.config,
      path: file.path,
      sha: file.sha,
      message: `Delete assets for ${workName}: ${file.path}`,
    });
  }

  return files.length;
}

async function deleteCurrentWork(navigateToDashboard) {
  if (!state.current || state.current.isNew || !state.current.path || !state.current.sha) return;
  const ok = confirm(`${t("deleteWorkConfirm", { name: state.current.name || state.current.path })}${deleteWorkAssetsWarning()}`);
  if (!ok) return;

  try {
    setBusy(true);
    const client = ensureClient();
    const imageFolders = collectImageFoldersFromManifest();

    for (const folderPath of imageFolders) {
      await deleteRepositoryFolderFiles(client, folderPath, state.current.name || state.current.path);
    }

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
  resetEditorListState();

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
  document.querySelector("#github-image-upload-btn")?.addEventListener("click", () => addGithubImageChapterWithDrawer(navigateToDashboard));
  document.querySelector("#github-folder-upload-btn")?.addEventListener("click", () => addGithubFolderChaptersWithDrawer(navigateToDashboard));
  document.querySelector("#multi-chapter-upload-btn")?.addEventListener("click", () => addMultipleChaptersWithDrawer(navigateToDashboard));

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
