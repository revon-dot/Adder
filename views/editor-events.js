import { state } from "../state.js";
import { toast } from "../ui.js";
import { showChapterEditModal } from "./chapter-modal.js";

function rerender(renderEditor, navigateToDashboard, updateEditorStats) {
  if (renderEditor && navigateToDashboard) renderEditor(navigateToDashboard);
  else updateEditorStats();
}

export function bindChapterButtons(scope = document, { updateEditorStats = () => {}, renderEditor = null, navigateToDashboard = null } = {}) {
  scope.querySelector("#chapter-search-input")?.addEventListener("input", (event) => {
    state.editor.chapterSearch = event.currentTarget.value;
    state.editor.chapterPage = 1;
    rerender(renderEditor, navigateToDashboard, updateEditorStats);
    const input = document.querySelector("#chapter-search-input");
    input?.focus();
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
        toast("Não consegui encontrar este capítulo para edição.", "error");
        return;
      }

      showChapterEditModal({
        number,
        chapter,
        onSave: ({ number: nextNumber, chapter: nextChapter }) => {
          if (!state.current.data.chapters) state.current.data.chapters = {};
          if (nextNumber !== number) delete state.current.data.chapters[number];
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
      if (!confirm(`Remover o capítulo ${number}?`)) return;
      delete state.current?.data?.chapters?.[number];
      rerender(renderEditor, navigateToDashboard, updateEditorStats);
    });
  });
}
