import { state } from "../state.js";
import { render, setBusy, toast, errorMessage } from "../ui.js";
import { escapeHtml, attr } from "../utils.js";
import { countImages, normalizeManifest } from "../cubari.js";
import { repoLabel, ensureClient, cubariUrlForPath, copyText } from "../helpers.js";

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
  const totalChapters = state.files.reduce((sum, file) => sum + (file.data ? Object.keys(file.data.chapters || {}).length : 0), 0);
  const totalImages = state.files.reduce((sum, file) => sum + (file.data ? countImages(file.data) : 0), 0);
  const query = state.search.trim().toLowerCase();
  const filtered = state.files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => {
      if (!query) return true;
      const title = file.data?.title || file.name;
      return `${title} ${file.name}`.toLowerCase().includes(query);
    });

  render(`
    <header class="dashboard-header dashboard-compact">
      <div class="dashboard-main">
        <div class="dashboard-title-wrap">
          <div class="dashboard-logo">A</div>
          <div>
            <p class="kicker">Dashboard</p>
            <h2>Biblioteca</h2>
          </div>
        </div>

        <div class="dashboard-status-row">
          <span class="status-pill"><span class="status-dot"></span>${escapeHtml(repoLabel())}</span>
          <span class="mini-stat"><strong>${state.files.length}</strong> JSONs</span>
          <span class="mini-stat"><strong>${totalChapters}</strong> capítulos</span>
          <span class="mini-stat"><strong>${totalImages}</strong> imagens</span>
        </div>
      </div>

      <div class="toolbar dashboard-toolbar">
        <button class="btn primary" id="new-manga-btn">Novo mangá</button>
        <button class="btn ghost" id="refresh-btn">Atualizar</button>
        <button class="btn ghost" id="change-repo-btn">Trocar repo</button>
      </div>
    </header>

    <section class="panel dashboard-panel">
      <div class="search-bar">
        <input id="search-input" data-keep-enabled="true" value="${attr(state.search)}" placeholder="Buscar por título ou arquivo..." />
        <span class="status-pill">${filtered.length} / ${state.files.length} JSONs</span>
      </div>

      ${filtered.length ? `<div class="cards-grid">${filtered.map(({ file, index }) => renderMangaCard(file, index)).join("")}</div>` : renderEmptyDashboard()}
    </section>
  `);

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
    state.search = event.currentTarget.value;
    renderDashboard(navigateToEditor, navigateToConnect);
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

function renderEmptyDashboard() {
  return `
    <div class="empty-state">
      <h3>Nenhum JSON encontrado</h3>
      <p>Crie um novo mangá ou confira se a pasta dos JSONs está correta.</p>
      <button class="btn primary" id="empty-new-btn">Criar primeiro JSON</button>
    </div>
  `;
}

function renderMangaCard(file, index) {
  const title = file.data?.title || file.name;
  const chapters = file.data ? Object.keys(file.data.chapters || {}).length : 0;
  const images = file.data ? countImages(file.data) : 0;
  const cover = file.data?.cover || "";
  const error = file.error ? `<p class="error-box">${escapeHtml(file.error)}</p>` : "";
  return `
    <article class="card">
      <div class="cover">
        ${cover ? `<img src="${attr(cover)}" alt="Capa de ${attr(title)}" loading="lazy" onerror="this.remove(); this.parentElement.innerHTML='<span class=&quot;cover-placeholder&quot;>Sem capa</span>'" />` : `<span class="cover-placeholder">Sem capa</span>`}
      </div>
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(title)}</h3>
        <p class="card-meta">${escapeHtml(file.name)}</p>
        ${error}
        <p class="card-meta">${chapters} capítulos · ${images} imagens</p>
        <div class="card-actions">
          <button class="btn primary small" data-open-file="${index}" ${file.data ? "" : "disabled"}>Editar</button>
          <button class="btn ghost small" data-copy-cubari="${index}">Copiar Cubari</button>
        </div>
      </div>
    </article>
  `;
}
