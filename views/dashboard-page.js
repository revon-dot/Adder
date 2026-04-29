import { state } from "../state.js";
import { escapeHtml, attr } from "../utils.js";
import { countImages } from "../cubari.js";
import { repoLabel } from "../repo.js";

export function getDashboardStats() {
  const totalChapters = state.files.reduce((sum, file) => sum + (file.data ? Object.keys(file.data.chapters || {}).length : 0), 0);
  const totalImages = state.files.reduce((sum, file) => sum + (file.data ? countImages(file.data) : 0), 0);
  return { totalChapters, totalImages };
}

export function getFilteredDashboardFiles() {
  const query = state.search.trim().toLowerCase();
  return state.files
    .map((file, index) => ({ file, index }))
    .filter(({ file }) => {
      if (!query) return true;
      const title = file.data?.title || file.name;
      return `${title} ${file.name}`.toLowerCase().includes(query);
    });
}

export function renderDashboardPage() {
  const { totalChapters, totalImages } = getDashboardStats();
  const filtered = getFilteredDashboardFiles();

  return `
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
  `;
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
