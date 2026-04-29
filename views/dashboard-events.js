import { state } from "../state.js";
import { setBusy, toast, errorMessage } from "../ui.js";
import { cubariUrlForPath } from "../repo.js";
import { copyText } from "../clipboard.js";

export function bindDashboardEvents({ navigateToEditor, navigateToConnect, renderDashboard, loadDashboard }) {
  document.querySelector("#new-manga-btn").addEventListener("click", () => navigateToEditor(null));
  document.querySelector("#empty-new-btn")?.addEventListener("click", () => navigateToEditor(null));
  document.querySelector("#refresh-btn").addEventListener("click", async () => {
    try {
      setBusy(true);
      await loadDashboard(() => renderDashboard(navigateToEditor, navigateToConnect));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
  document.querySelector("#change-repo-btn").addEventListener("click", () => navigateToConnect({ ...state.config }));
  document.querySelector("#search-input").addEventListener("input", (event) => {
    const cursorPosition = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
    state.search = event.currentTarget.value;
    renderDashboard(navigateToEditor, navigateToConnect);
    const searchInput = document.querySelector("#search-input");
    searchInput?.focus();
    searchInput?.setSelectionRange(cursorPosition, cursorPosition);
  });

  document.querySelectorAll("[data-open-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const file = state.files[Number(button.dataset.openFile)];
      if (file?.data) navigateToEditor(file);
    });
  });

  document.querySelectorAll("[data-copy-cubari]").forEach((button) => {
    button.addEventListener("click", async () => {
      const file = state.files[Number(button.dataset.copyCubari)];
      if (!file) return;
      await copyText(cubariUrlForPath(file.path));
    });
  });
}
