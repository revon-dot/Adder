import { toast } from "../ui.js";
import { importImgChestIntoGroup, extractImgChestFromTextarea } from "./editor-imgchest-tools.js";

export function bindChapterButtons(scope = document, updateEditorStats = () => {}) {
  scope.querySelectorAll("[data-toggle-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const card = button.closest("[data-chapter-card]");
      const content = card?.querySelector("[data-groups-list]");
      if (!content) return;
      content.classList.toggle("collapsed");
      button.textContent = content.classList.contains("collapsed") ? "Expandir" : "Alternar";
    });
  });

  scope.querySelectorAll("[data-remove-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      if (!confirm("Remover este capítulo?")) return;
      button.closest("[data-chapter-card]")?.remove();
      updateEditorStats();
    });
  });

  scope.querySelectorAll("[data-remove-group]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const chapter = button.closest("[data-chapter-card]");
      const groups = chapter?.querySelectorAll("[data-group-card]") || [];
      if (groups.length <= 1) {
        toast("O capítulo precisa ter pelo menos um grupo.", "error");
        return;
      }
      button.closest("[data-group-card]")?.remove();
      updateEditorStats();
    });
  });

  scope.querySelectorAll("[data-import-imgchest]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => importImgChestIntoGroup(button, updateEditorStats));
  });

  scope.querySelectorAll("[data-extract-imgchest]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => extractImgChestFromTextarea(button, updateEditorStats));
  });
}
