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
          <div class="dashboard-logo favicon-logo"><img src="./favicon.svg" alt="Adder" /></div>
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

      ${filtered.length ? renderMangaList(filtered) : renderEmptyDashboard()}
    </section>
  `;
}

function renderEmptyDashboard() {
  return `
    <div class="empty-state">
      <h3>Nenhum JSON encontrado</h3>
      <p>Não encontramos obras nesta pasta do repositório. Crie um novo mangá para começar ou revise a pasta configurada.</p>
      <div class="row-actions" style="justify-content: center;">
        <button class="btn primary" id="empty-new-btn">Novo mangá</button>
        <button class="btn ghost" id="empty-change-repo-btn">Trocar repo</button>
      </div>
    </div>
  `;
}

function renderMangaList(filtered) {
  return `
    <div class="manga-list-wrap">
      <table class="manga-table">
        <thead>
          <tr>
            <th>Obra</th>
            <th>Arquivo</th>
            <th>Capítulos</th>
            <th>Imagens</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(({ file, index }) => renderMangaRow(file, index)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderMangaRow(file, index) {
  const title = file.data?.title || file.name;
  const chapters = file.data ? Object.keys(file.data.chapters || {}).length : 0;
  const images = file.data ? countImages(file.data) : 0;
  const cover = file.data?.cover || "";
  const error = file.error ? `<span class="manga-row-error">${escapeHtml(file.error)}</span>` : "";
  return `
    <tr class="manga-row">
      <td>
        <div class="manga-title-cell">
          <div class="manga-thumb">
            ${cover ? `<img src="${attr(cover)}" alt="Capa de ${attr(title)}" loading="lazy" onerror="this.remove(); this.parentElement.innerHTML='<span>—</span>'" />` : `<span>—</span>`}
          </div>
          <div>
            <strong>${escapeHtml(title)}</strong>
            ${error}
            <span class="manga-mobile-meta">${chapters} capítulos · ${images} imagens</span>
          </div>
        </div>
      </td>
      <td><span class="file-name">${escapeHtml(file.name)}</span></td>
      <td>${chapters}</td>
      <td>${images}</td>
      <td>
        <div class="manga-actions compact-actions">
          <button class="btn primary small" data-open-file="${index}" ${file.data ? "" : "disabled"}>Editar</button>
          <button class="btn ghost small" data-copy-cubari="${index}">Copiar Cubari</button>
        </div>
      </td>
    </tr>
  `;
}
