import { state } from "../state.js";
import { render, errorMessage } from "../ui.js";
import { escapeHtml } from "../utils.js";
import { normalizeManifest } from "../cubari.js";
import { repoLabel, ensureClient } from "../repo.js";
import { renderDashboardPage } from "./dashboard-page.js";
import { bindDashboardEvents } from "./dashboard-events.js";
import { t } from "../i18n.js";
import { githubImageDefaults } from "../github-image-links.js";

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

function isDashboardSurfaceVisible(loadId) {
  return Boolean(
    document.querySelector(`[data-dashboard-load-id="${loadId}"]`) ||
    document.querySelector(".dashboard-header"),
  );
}

function canUpdateDashboard(loadId) {
  return isDashboardLoadCurrent(loadId) && isDashboardSurfaceVisible(loadId);
}

function resetStorageEstimate(root = githubImageDefaults.imagesRoot) {
  state.storage = {
    status: "loading",
    root,
    bytes: 0,
    fileCount: 0,
    error: "",
  };
}

async function collectRepositoryStorage(client, path) {
  let contents;

  try {
    contents = await client.listContents({
      ...state.config,
      path,
    });
  } catch (error) {
    if (error.status === 404) {
      return { bytes: 0, fileCount: 0 };
    }
    throw error;
  }

  const items = Array.isArray(contents) ? contents : [contents];
  const result = { bytes: 0, fileCount: 0 };

  for (const item of items) {
    if (item.type === "file") {
      result.bytes += Number(item.size) || 0;
      result.fileCount += 1;
      continue;
    }

    if (item.type === "dir") {
      const nested = await collectRepositoryStorage(client, item.path);
      result.bytes += nested.bytes;
      result.fileCount += nested.fileCount;
    }
  }

  return result;
}

function refreshDashboardIfStillCurrent(renderDashboardCallback, navigateToEditor, navigateToConnect, loadId = dashboardLoadId) {
  try {
    if (!canUpdateDashboard(loadId)) return;
    if (!document.querySelector(".dashboard-header")) return;
    renderDashboardCallback(navigateToEditor, navigateToConnect);
  } catch {
    // Storage numbers are informational. Never let them break the dashboard.
  }
}

async function loadStorageEstimate(client, renderDashboardCallback = null, navigateToEditor = null, navigateToConnect = null, loadId = dashboardLoadId) {
  const root = githubImageDefaults.imagesRoot;
  if (!canUpdateDashboard(loadId)) return;
  resetStorageEstimate(root);

  try {
    const estimate = await withTimeout(collectRepositoryStorage(client, root), 30000);
    if (!canUpdateDashboard(loadId)) return;

    state.storage = {
      status: "ready",
      root,
      bytes: estimate.bytes,
      fileCount: estimate.fileCount,
      error: "",
    };
  } catch (error) {
    if (!canUpdateDashboard(loadId)) return;

    state.storage = {
      status: "error",
      root,
      bytes: 0,
      fileCount: 0,
      error: errorMessage(error),
    };
  }

  if (renderDashboardCallback) {
    refreshDashboardIfStillCurrent(renderDashboardCallback, navigateToEditor, navigateToConnect, loadId);
  }
}

export async function loadDashboard(navigateToDashboard, navigateToConnect = null, navigateToEditor = null) {
  const loadId = dashboardLoadId + 1;
  dashboardLoadId = loadId;

  renderLoading(t("loadingJsons"), loadId);

  try {
    const client = ensureClient();
    const config = state.config;
    resetStorageEstimate();

    const jsonFiles = await withTimeout(client.listJsonFiles({
      ...config,
      path: config.jsonPath,
    }));

    if (!canUpdateDashboard(loadId)) return;

    if (!jsonFiles.length) {
      state.files = [];
      navigateToDashboard();
      loadStorageEstimate(client, renderDashboard, navigateToEditor, navigateToConnect, loadId);
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
    loadStorageEstimate(client, renderDashboard, navigateToEditor, navigateToConnect, loadId);
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
