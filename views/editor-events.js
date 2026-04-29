import { state } from "../state.js";
import { toast } from "../ui.js";
import { showChapterEditModal } from "./chapter-modal.js";

export function bindChapterButtons(scope = document, { updateEditorStats = () => {}, renderEditor = null, navigateToDashboard = null } = {}) {
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
          if (renderEditor && navigateToDashboard) renderEditor(navigateToDashboard);
          else updateEditorStats();
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
      if (renderEditor && navigateToDashboard) renderEditor(navigateToDashboard);
      else updateEditorStats();
    });
  });
}
