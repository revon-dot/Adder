import { state } from "../state.js";
import { render, errorMessage } from "../ui.js";
import { escapeHtml } from "../utils.js";
import { normalizeManifest } from "../cubari.js";
import { repoLabel, ensureClient } from "../repo.js";
import { renderDashboardPage } from "./dashboard-page.js";
import { bindDashboardEvents } from "./dashboard-events.js";
import { t } from "../i18n.js";

let dashboardLoadId = 0;

function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Tempo limite ao carregar arquivos do GitHub.")), ms);
    }),
  ]);
}

function isDashboardLoadCurrent(loadId) {
  return loadId === dashboardLoadId;
}

function hasDashboardLoadingSurface(loadId) {
  return Boolean(document.querySelector(`[data-dashboard-load-id="${loadId}"]`));
}

function hasDashboardContentSurface() {
  return Boolean(document.querySelector(".dashboard-panel"));
}

function isDashboardSurfaceVisible(loadId) {
  return hasDashboardLoadingSurface(loadId) || hasDashboardContentSurface();
}

function canUpdateDashboard(loadId) {
  return isDashboardLoadCurrent(loadId) && isDashboardSurfaceVisible(loadId);
}

export async function loadDashboard(navigateToDashboard, navigateToConnect = null, navigateToEditor = null) {
  const loadId = dashboardLoadId + 1;
  dashboardLoadId = loadId;

  renderLoading(t("loadingJsons"), loadId);

  try {
    const client = ensureClient();
    const config = state.config;

    const jsonFiles = await withTimeout(client.listJsonFiles({
      ...config,
      path: config.jsonPath,
    }));

    if (!canUpdateDashboard(loadId)) return;

    if (!jsonFiles.length) {
      state.files = [];
      navigateToDashboard();
      return;
    }

    const loaded = [];

    for (const file of jsonFiles) {
      if (!canUpdateDashboard(loadId)) return;

      try {
        const fetched = await client.getFile({ ...config, path: file.path });
        if (!canUpdateDashboard(loadId)) return;

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
        if (!canUpdateDashboard(loadId)) return;

        loaded.push({
          name: file.name,
          path: file.path,
          sha: file.sha,
          error: errorMessage(error),
          data: null,
        });
      }
    }

    if (!canUpdateDashboard(loadId)) return;

    state.files = loaded;
    navigateToDashboard();
  } catch (error) {
    if (!canUpdateDashboard(loadId)) return;

    if (error?.status === 404 || error?.status === 409) {
      state.files = [];
      navigateToDashboard();
      return;
    }

    renderLoadError(error, navigateToDashboard, navigateToConnect, navigateToEditor);
  }
}

function renderLoading(text = "Carregando...", loadId = dashboardLoadId) {
  render(`
    <section class="panel loading" data-dashboard-load-id="${escapeHtml(String(loadId))}">
      <div>
        <div class="spinner"></div>
        <h2>${escapeHtml(text)}</h2>
        <p>${escapeHtml(repoLabel())}</p>
      </div>
    </section>
  `);
}

function renderLoadError(error, navigateToDashboard, navigateToConnect, navigateToEditor) {
  const message = error?.status === 404 ? t("dashboardLoadErrorNotFound") : errorMessage(error);
  state.files = [];
  render(`
    <section class="panel loading">
      <div>
        <h2>${t("dashboardLoadErrorTitle")}</h2>
        <p>${escapeHtml(repoLabel())}</p>
        <div class="error-box" style="margin: 16px 0; text-align: left;">${escapeHtml(message)}</div>
        <div class="row-actions" style="justify-content: center;">
          <button class="btn primary" id="load-error-new-manga-btn">${t("newManga")}</button>
          <button class="btn ghost" id="retry-dashboard-load-btn">${t("retry")}</button>
          <button class="btn ghost" id="load-error-change-repo-btn">${t("changeRepo")}</button>
        </div>
      </div>
    </section>
  `);

  document.querySelector("#load-error-new-manga-btn")?.addEventListener("click", () => {
    if (navigateToEditor) navigateToEditor(null);
  });
  document.querySelector("#retry-dashboard-load-btn")?.addEventListener("click", () => loadDashboard(navigateToDashboard, navigateToConnect, navigateToEditor));
  document.querySelector("#load-error-change-repo-btn")?.addEventListener("click", () => {
    if (navigateToConnect) navigateToConnect({ ...state.config });
  });
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
