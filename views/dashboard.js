import { state } from "../state.js";
import { render, toast, errorMessage } from "../ui.js";
import { escapeHtml } from "../utils.js";
import { normalizeManifest } from "../cubari.js";
import { repoLabel, ensureClient } from "../repo.js";
import { renderDashboardPage } from "./dashboard-page.js";
import { bindDashboardEvents } from "./dashboard-events.js";

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
  bindDashboardEvents({
    navigateToEditor,
    navigateToConnect,
    renderDashboard,
    loadDashboard,
  });
}
