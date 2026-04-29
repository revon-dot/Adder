import { state } from "../state.js";
import { render, setBusy, toast, errorMessage } from "../ui.js";
import { escapeHtml } from "../utils.js";
import { normalizeManifest } from "../cubari.js";
import { repoLabel, ensureClient, cubariUrlForPath } from "../repo.js";
import { copyText } from "../clipboard.js";
import { renderDashboardPage } from "./dashboard-page.js";

export async function loadDashboard(navigateToDashboard) {
  renderLoading("Lendo arquivos JSON...");
  try {
    const client = ensureClient();
    const config = state.config;
    const jsonFiles = await client.listJsonFiles({
      ...config,
      path: config.jsonPath,
    });
    const loaded = [];

    for (const file of jsonFiles) {
      try {
        const fetched = await client.getFile({ ...config, path: file.path });
        const parsed = normalizeManifest(JSON.parse(fetched.text));
        loaded.push({
          name: file.name,
          path: file.path,
          sha: fetched.sha,
          htmlUrl: fetched.html_url,
          downloadUrl: fetched.download_url,
          data: parsed,
        });
      } catch (error) {
        loaded.push({
          name: file.name,
          path: file.path,
          sha: file.sha,
          error: errorMessage(error),
          data: null,
        });
      }
    }

    state.files = loaded;
    navigateToDashboard();
  } catch (error) {
    toast(errorMessage(error), "error");
  }
}

function renderLoading(text = "Carregando...") {
  render(`
    <section class="panel loading">
      <div>
        <div class="spinner"></div>
        <h2>${escapeHtml(text)}</h2>
        <p>${escapeHtml(repoLabel())}</p>
      </div>
    </section>
  `);
}

export function renderDashboard(navigateToEditor, navigateToConnect) {
  render(renderDashboardPage());
  bindDashboardEvents(navigateToEditor, navigateToConnect);
}

function bindDashboardEvents(navigateToEditor, navigateToConnect) {
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
