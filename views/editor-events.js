import { state } from "../state.js";
import { toast, setBusy, errorMessage } from "../ui.js";
import { sortChapterEntries } from "../cubari.js";
import { showChapterEditModal } from "./chapter-modal.js";
import { t } from "../i18n.js";
import { ensureClient } from "../repo.js";

function rerender(renderEditor, navigateToDashboard, updateEditorStats) {
  if (renderEditor && navigateToDashboard) renderEditor(navigateToDashboard);
  else updateEditorStats();
}

function selectedSet() {
  return new Set(state.editor.selectedChapters || []);
}

function saveSelectedChapters(selected) {
  state.editor.selectedChapters = [...selected];
}

function getVisibleChapterNumbers(scope = document) {
  return [...scope.querySelectorAll("[data-select-chapter]")]
    .map((input) => input.dataset.selectChapter)
    .filter(Boolean);
}

function selectRange({ scope, selected, from, to, checked }) {
  const visibleNumbers = getVisibleChapterNumbers(scope);
  const fromIndex = visibleNumbers.indexOf(from);
  const toIndex = visibleNumbers.indexOf(to);

  if (fromIndex < 0 || toIndex < 0) {
    if (checked) selected.add(to);
    else selected.delete(to);
    return;
  }

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);

  visibleNumbers.slice(start, end + 1).forEach((number) => {
    if (checked) selected.add(number);
    else selected.delete(number);
  });
}

function pruneSelection() {
  const chapters = state.current?.data?.chapters || {};
  const valid = new Set(Object.keys(chapters));
  state.editor.selectedChapters = (state.editor.selectedChapters || []).filter((number) => valid.has(number));
  if (state.editor.lastSelectedChapter && !valid.has(state.editor.lastSelectedChapter)) {
    state.editor.lastSelectedChapter = null;
  }
}

function bulkDeleteConfirm(numbers) {
  const preview = numbers.slice(0, 12).join(", ");
  const rest = numbers.length > 12 ? `, +${numbers.length - 12}` : "";
  return confirm(
    `Excluir ${numbers.length} capítulo(s)?\n\n${preview}${rest}\n\n` +
      "Os arquivos de imagem desses capítulos também serão deletados do repositório quando forem URLs deste GitHub.\n\n" +
      "Depois clique em Salvar no GitHub para gravar a remoção no JSON."
  );
}

function safeDecodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function branchParts() {
  return String(state.config?.branch || "main").split("/").filter(Boolean);
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
  const branch = branchParts();

  if (parsed.hostname === "raw.githubusercontent.com") {
    const matchesRepo = pathParts[0] === owner && pathParts[1] === repo;
    const matchesBranch = branch.every((part, index) => pathParts[index + 2] === part);
    if (!matchesRepo || !matchesBranch) return "";
    return pathParts.slice(2 + branch.length).join("/");
  }

  if (parsed.hostname === `${owner}.github.io`) {
    if (pathParts[0] !== repo) return "";
    return pathParts.slice(1).join("/");
  }

  return "";
}

function collectChapterRepositoryPaths(chapter = {}) {
  const paths = new Set();

  Object.values(chapter?.groups || {}).forEach((urls) => {
    if (!Array.isArray(urls)) return;
    urls.forEach((url) => {
      const path = extractRepositoryPathFromImageUrl(url);
      if (path) paths.add(path);
    });
  });

  return [...paths];
}

async function getFileSha(client, path) {
  try {
    const file = await client.listContents({
      ...state.config,
      path,
    });

    if (Array.isArray(file) || file?.type !== "file") return null;
    return file.sha || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function deleteRepositoryFileIfExists(client, path, chapterNumber) {
  const sha = await getFileSha(client, path);
  if (!sha) return false;

  await client.deleteFile({
    ...state.config,
    path,
    sha,
    message: `Delete assets for chapter ${chapterNumber}: ${path}`,
  });

  return true;
}

async function deleteChapterAssets(number, chapter) {
  const paths = collectChapterRepositoryPaths(chapter);
  if (!paths.length) return 0;

  const client = ensureClient();
  let deleted = 0;

  for (const path of paths) {
    const didDelete = await deleteRepositoryFileIfExists(client, path, number);
    if (didDelete) deleted += 1;
  }

  return deleted;
}

async function removeChapterAndAssets(number, { renderEditor, navigateToDashboard, updateEditorStats }) {
  const chapter = state.current?.data?.chapters?.[number];
  if (!number || !chapter) return;

  try {
    setBusy(true);
    const deletedFiles = await deleteChapterAssets(number, chapter);
    delete state.current?.data?.chapters?.[number];
    state.editor.selectedChapters = (state.editor.selectedChapters || []).filter((selected) => selected !== number);
    if (state.editor.lastSelectedChapter === number) state.editor.lastSelectedChapter = null;

    const suffix = deletedFiles
      ? ` ${deletedFiles} arquivo(s) de imagem deletado(s) do repositório.`
      : " Nenhum arquivo interno do repositório foi encontrado para deletar.";
    toast(`Capítulo ${number} removido.${suffix}`, "success");
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
  } catch (error) {
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}

async function removeSelectedChaptersAndAssets(numbers, { renderEditor, navigateToDashboard, updateEditorStats }) {
  try {
    setBusy(true);
    let deletedFiles = 0;
    const chapters = state.current?.data?.chapters || {};

    for (const number of numbers) {
      const chapter = chapters[number];
      if (!chapter) continue;
      deletedFiles += await deleteChapterAssets(number, chapter);
      delete chapters[number];
    }

    state.editor.selectedChapters = [];
    state.editor.lastSelectedChapter = null;
    toast(`${numbers.length} capítulo(s) removido(s). ${deletedFiles} arquivo(s) de imagem deletado(s) do repositório.`, "success");
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
  } catch (error) {
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}

function bindSelectionControls(scope, { updateEditorStats, renderEditor, navigateToDashboard }) {
  pruneSelection();

  scope.querySelectorAll("[data-indeterminate='true']").forEach((input) => {
    if (input instanceof HTMLInputElement) input.indeterminate = true;
  });

  scope.querySelectorAll("[data-select-chapter]").forEach((input) => {
    if (input.dataset.bound === "true") return;
    input.dataset.bound = "true";
    input.addEventListener("click", (event) => {
      const number = input.dataset.selectChapter;
      if (!number) return;

      const selected = selectedSet();
      const checked = input.checked;

      if (event.shiftKey && state.editor.lastSelectedChapter) {
        selectRange({
          scope,
          selected,
          from: state.editor.lastSelectedChapter,
          to: number,
          checked,
        });
      } else if (checked) {
        selected.add(number);
      } else {
        selected.delete(number);
      }

      state.editor.lastSelectedChapter = number;
      saveSelectedChapters(selected);
      rerender(renderEditor, navigateToDashboard, updateEditorStats);
    });
  });

  scope.querySelector("[data-select-visible-chapters]")?.addEventListener("change", (event) => {
    const selected = selectedSet();
    const visibleNumbers = getVisibleChapterNumbers(scope);
    const checked = event.currentTarget.checked;

    visibleNumbers.forEach((number) => {
      if (checked) selected.add(number);
      else selected.delete(number);
    });

    state.editor.lastSelectedChapter = checked ? visibleNumbers.at(-1) || null : null;
    saveSelectedChapters(selected);
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
  });

  scope.querySelector("#clear-selected-chapters-btn")?.addEventListener("click", () => {
    state.editor.selectedChapters = [];
    state.editor.lastSelectedChapter = null;
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
  });

  scope.querySelector("#delete-selected-chapters-btn")?.addEventListener("click", async () => {
    const chapters = state.current?.data?.chapters || {};
    const selected = new Set(state.editor.selectedChapters || []);
    const sortedNumbers = sortChapterEntries(chapters)
      .map(([number]) => number)
      .filter((number) => selected.has(number));

    if (!sortedNumbers.length) return;
    if (!bulkDeleteConfirm(sortedNumbers)) return;

    await removeSelectedChaptersAndAssets(sortedNumbers, { renderEditor, navigateToDashboard, updateEditorStats });
  });
}

export function bindChapterButtons(scope = document, { updateEditorStats = () => {}, renderEditor = null, navigateToDashboard = null } = {}) {
  bindSelectionControls(scope, { updateEditorStats, renderEditor, navigateToDashboard });

  scope.querySelector("#chapter-search-input")?.addEventListener("input", (event) => {
    state.editor.chapterSearch = event.currentTarget.value;
    state.editor.chapterPage = 1;
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
    const input = document.querySelector("#chapter-search-input");
    input?.focus();
  });

  scope.querySelector("#chapter-page-size-select")?.addEventListener("change", (event) => {
    const value = event.currentTarget.value;
    if (!value) return;
    state.editor.chapterPageSize = value === "all" ? "all" : Number(value) || 10;
    state.editor.chapterPageSizeSelected = true;
    state.editor.chapterPage = 1;
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
  });

  scope.querySelectorAll("[data-chapter-page]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const direction = button.dataset.chapterPage;
      if (direction === "prev") state.editor.chapterPage -= 1;
      if (direction === "next") state.editor.chapterPage += 1;
      rerender(renderEditor, navigateToDashboard, updateEditorStats);
    });
  });

  scope.querySelectorAll("[data-edit-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const number = button.dataset.editChapter;
      const chapter = state.current?.data?.chapters?.[number];
      if (!number || !chapter) {
        toast(t("chapterNotFound"), "error");
        return;
      }

      showChapterEditModal({
        number,
        chapter,
        onSave: ({ number: nextNumber, chapter: nextChapter }) => {
          if (!state.current.data.chapters) state.current.data.chapters = {};
          if (nextNumber !== number) {
            delete state.current.data.chapters[number];
            state.editor.selectedChapters = (state.editor.selectedChapters || []).filter((selected) => selected !== number);
          }
          state.current.data.chapters[nextNumber] = nextChapter;
          rerender(renderEditor, navigateToDashboard, updateEditorStats);
        },
      });
    });
  });

  scope.querySelectorAll("[data-remove-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      const number = button.dataset.removeChapter;
      if (!number) return;
      const ok = confirm(
        `${t("removeChapterConfirm", { number })}\n\n` +
          "Os arquivos de imagem deste capítulo também serão deletados do repositório quando forem URLs deste GitHub.\n\n" +
          "Depois clique em Salvar no GitHub para gravar a remoção no JSON."
      );
      if (!ok) return;
      await removeChapterAndAssets(number, { renderEditor, navigateToDashboard, updateEditorStats });
    });
  });
}
