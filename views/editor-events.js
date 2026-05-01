import { state } from "../state.js";
import { toast } from "../ui.js";
import { sortChapterEntries } from "../cubari.js";
import { showChapterEditModal } from "./chapter-modal.js";
import { t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
    label(`Excluir ${numbers.length} capítulo(s)?`, `Delete ${numbers.length} chapter(s)?`) +
      `\n\n${preview}${rest}\n\n` +
      label(
        "A remoção será aplicada ao JSON aberto. Depois clique em Salvar no GitHub para gravar a alteração.",
        "The removal will be applied to the open JSON. Then click Save to GitHub to write the change.",
      )
  );
}

function removeChapterFromJson(number, { renderEditor, navigateToDashboard, updateEditorStats }) {
  const chapter = state.current?.data?.chapters?.[number];
  if (!number || !chapter) return;

  delete state.current?.data?.chapters?.[number];
  state.editor.selectedChapters = (state.editor.selectedChapters || []).filter((selected) => selected !== number);
  if (state.editor.lastSelectedChapter === number) state.editor.lastSelectedChapter = null;

  toast(label(`Capítulo ${number} removido do JSON. Clique em Salvar no GitHub para gravar.`, `Chapter ${number} removed from the JSON. Click Save to GitHub to write it.`), "success");
  rerender(renderEditor, navigateToDashboard, updateEditorStats);
}

function removeSelectedChaptersFromJson(numbers, { renderEditor, navigateToDashboard, updateEditorStats }) {
  const chapters = state.current?.data?.chapters || {};

  numbers.forEach((number) => {
    if (chapters[number]) delete chapters[number];
  });

  state.editor.selectedChapters = [];
  state.editor.lastSelectedChapter = null;
  toast(label(`${numbers.length} capítulo(s) removido(s) do JSON. Clique em Salvar no GitHub para gravar.`, `${numbers.length} chapter(s) removed from the JSON. Click Save to GitHub to write it.`), "success");
  rerender(renderEditor, navigateToDashboard, updateEditorStats);
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

  scope.querySelector("#delete-selected-chapters-btn")?.addEventListener("click", () => {
    const chapters = state.current?.data?.chapters || {};
    const selected = new Set(state.editor.selectedChapters || []);
    const sortedNumbers = sortChapterEntries(chapters)
      .map(([number]) => number)
      .filter((number) => selected.has(number));

    if (!sortedNumbers.length) return;
    if (!bulkDeleteConfirm(sortedNumbers)) return;

    removeSelectedChaptersFromJson(sortedNumbers, { renderEditor, navigateToDashboard, updateEditorStats });
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
    button.addEventListener("click", () => {
      const number = button.dataset.removeChapter;
      if (!number) return;
      const ok = confirm(
        `${t("removeChapterConfirm", { number })}\n\n` +
          label(
            "A remoção será aplicada ao JSON aberto. Depois clique em Salvar no GitHub para gravar a alteração.",
            "The removal will be applied to the open JSON. Then click Save to GitHub to write the change.",
          )
      );
      if (!ok) return;
      removeChapterFromJson(number, { renderEditor, navigateToDashboard, updateEditorStats });
    });
  });
}
