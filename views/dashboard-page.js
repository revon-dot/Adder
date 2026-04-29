import { state } from "../state.js";
import { escapeHtml, attr } from "../utils.js";
import { countImages } from "../cubari.js";
import { repoLabel } from "../repo.js";
import { renderLanguageToggle, t } from "../i18n.js";

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
            <p class="kicker">${t("dashboard")}</p>
            <h2>${t("library")}</h2>
          </div>
        </div>

        <div class="dashboard-status-row">
          <span class="status-pill"><span class="status-dot"></span>${escapeHtml(repoLabel())}</span>
          <span class="mini-stat"><strong>${state.files.length}</strong> ${t("jsons")}</span>
          <span class="mini-stat"><strong>${totalChapters}</strong> ${t("chapters")}</span>
          <span class="mini-stat"><strong>${totalImages}</strong> ${t("images")}</span>
        </div>
      </div>

      <div class="toolbar dashboard-toolbar">
        <button class="btn primary" id="new-manga-btn">${t("newManga")}</button>
        <button class="btn ghost" id="refresh-btn">${t("refresh")}</button>
        <button class="btn ghost" id="change-repo-btn">${t("changeRepo")}</button>
        ${renderLanguageToggle("dashboard-language")}
      </div>
    </header>

    <section class="panel dashboard-panel">
      <div class="search-bar">
        <input id="search-input" data-keep-enabled="true" value="${attr(state.search)}" placeholder="${attr(t("searchPlaceholder"))}" />
        <span class="status-pill">${filtered.length} / ${state.files.length} ${t("jsons")}</span>
      </div>

      ${filtered.length ? renderMangaList(filtered) : renderEmptyDashboard()}
    </section>
  `;
}

function renderEmptyDashboard() {
  return `
    <div class="empty-state">
      <h3>${t("noJsonFound")}</h3>
      <p>${t("noJsonFoundDescription")}</p>
      <div class="row-actions" style="justify-content: center;">
        <button class="btn primary" id="empty-new-btn">${t("newManga")}</button>
        <button class="btn ghost" id="empty-change-repo-btn">${t("changeRepo")}</button>
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
            <th>${t("work")}</th>
            <th>${t("file")}</th>
            <th>${t("chapters")}</th>
            <th>${t("images")}</th>
            <th>${t("actions")}</th>
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
            <span class="manga-mobile-meta">${chapters} ${t("chapters")} · ${images} ${t("images")}</span>
          </div>
        </div>
      </td>
      <td><span class="file-name">${escapeHtml(file.name)}</span></td>
      <td>${chapters}</td>
      <td>${images}</td>
      <td>
        <div class="manga-actions compact-actions">
          <button class="btn primary small" data-open-file="${index}" ${file.data ? "" : "disabled"}>${t("edit")}</button>
          <button class="btn ghost small" data-copy-cubari="${index}">${t("copyCubari")}</button>
        </div>
      </td>
    </tr>
  `;
}
