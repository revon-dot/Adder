import { state } from "../state.js";
import { setBusy, toast, errorMessage } from "../ui.js";
import { cubariUrlForPath } from "../repo.js";
import { copyText } from "../clipboard.js";
import { bindLanguageToggle } from "../i18n.js";

function bindClick(selector, handler) {
  document.querySelector(selector)?.addEventListener("click", handler);
}

export function bindDashboardEvents({ navigateToEditor, navigateToConnect, renderDashboard, loadDashboard }) {
  bindLanguageToggle(() => renderDashboard(navigateToEditor, navigateToConnect));
  bindClick("#new-manga-btn", () => navigateToEditor(null));
  bindClick("#empty-new-btn", () => navigateToEditor(null));
  bindClick("#empty-change-repo-btn", () => navigateToConnect({ ...state.config }));
  bindClick("#refresh-btn", async () => {
    try {
      setBusy(true);
      await loadDashboard(() => renderDashboard(navigateToEditor, navigateToConnect));
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
  bindClick("#change-repo-btn", () => navigateToConnect({ ...state.config }));

  document.querySelector("#search-input")?.addEventListener("input", (event) => {
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
      else toast("Este JSON não pôde ser carregado para edição.", "error");
    });
  });

  document.querySelectorAll("[data-copy-cubari]").forEach((button) => {
    button.addEventListener("click", async () => {
      const file = state.files[Number(button.dataset.copyCubari)];
      if (!file) return;
      const cubariUrl = cubariUrlForPath(file.path);
      if (!cubariUrl) {
        toast("Não consegui gerar a URL Cubari deste arquivo.", "error");
        return;
      }
      await copyText(cubariUrl);
    });
  });
}
