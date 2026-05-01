import { state } from "../state.js";
import { escapeHtml, attr } from "../utils.js";
import { repoLabel } from "../repo.js";
import { renderLanguageToggle, t } from "../i18n.js";

const SAFE_STORAGE_BYTES = 1 * 1024 * 1024 * 1024;
const WARNING_STORAGE_BYTES = 5 * 1024 * 1024 * 1024;
const CRITICAL_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

function label(pt, en) {
  return document.documentElement.lang === "en" ? en : pt;
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

function getStorageLevel(bytes = 0) {
  if (bytes >= WARNING_STORAGE_BYTES) return "danger";
  if (bytes >= SAFE_STORAGE_BYTES) return "warning";
  return "safe";
}

function getStorageLimitForProgress(bytes = 0) {
  if (bytes >= WARNING_STORAGE_BYTES) return CRITICAL_STORAGE_BYTES;
  if (bytes >= SAFE_STORAGE_BYTES) return WARNING_STORAGE_BYTES;
  return SAFE_STORAGE_BYTES;
}

function getStorageCopy(bytes = 0) {
  const level = getStorageLevel(bytes);

  if (level === "danger") {
    return {
      title: label("Armazenamento crítico", "Critical storage"),
      message: label("Este repositório já passou da zona segura. Considere dividir obras ou mover imagens para um storage/CDN.", "This repository is past the safe zone. Consider splitting works or moving images to storage/CDN."),
      limitLabel: label("limite crítico recomendado", "recommended critical limit"),
    };
  }

  if (level === "warning") {
    return {
      title: label("Atenção ao armazenamento", "Storage warning"),
      message: label("Ainda funciona para MVP, mas o repositório já passou do ideal seguro de 1 GB.", "Still usable for an MVP, but the repository is past the ideal safe 1 GB target."),
      limitLabel: label("zona de atenção", "warning zone"),
    };
  }

  return {
    title: label("Armazenamento seguro", "Safe storage"),
    message: label("Uso estimado dentro da zona segura para MVP.", "Estimated usage is inside the safe MVP zone."),
    limitLabel: label("limite seguro", "safe limit"),
  };
}

export function getDashboardStats() {
  const totalChapters = state.files.reduce((sum, file) => sum + (file.data ? Object.keys(file.data.chapters || {}).length : 0), 0);
  return { totalChapters };
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
  const { totalChapters } = getDashboardStats();
  const filtered = getFilteredDashboardFiles();
  const worksLabel = label("Obras", "Works");
  const chaptersLabel = label("Capítulos", "Chapters");

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
          <span class="mini-stat"><strong>${state.files.length}</strong> ${worksLabel}</span>
          <span class="mini-stat"><strong>${totalChapters}</strong> ${chaptersLabel}</span>
        </div>
      </div>

      <div class="toolbar dashboard-toolbar">
        <button class="btn primary" id="new-manga-btn">${label("Novo Mangá", "New Manga")}</button>
        <button class="btn ghost" id="refresh-btn">${t("refresh")}</button>
        <button class="btn ghost" id="change-repo-btn">${label("Trocar Repo", "Change Repo")}</button>
        ${renderLanguageToggle("dashboard-language")}
      </div>
    </header>

    ${renderStorageCard()}

    <section class="panel dashboard-panel">
      <div class="search-bar">
        <input id="search-input" data-keep-enabled="true" value="${attr(state.search)}" placeholder="${attr(t("searchPlaceholder"))}" />
        <span class="status-pill">${filtered.length} / ${state.files.length} ${worksLabel}</span>
      </div>

      ${filtered.length ? renderMangaList(filtered) : renderEmptyDashboard()}
    </section>
  `;
}

function renderStorageCard() {
  const storage = state.storage || {};
  const root = storage.root || "mangas";

  if (storage.status === "loading") {
    return `
      <section class="storage-card storage-loading">
        <div>
          <p class="kicker">${label("Armazenamento", "Storage")}</p>
          <h3>${label("Calculando uso das imagens...", "Calculating image usage...")}</h3>
          <p>${label("Estimando arquivos dentro da pasta", "Estimating files inside")} <code>${escapeHtml(root)}/</code>.</p>
        </div>
        <div class="storage-spinner" aria-hidden="true"></div>
      </section>
    `;
  }

  if (storage.status === "error") {
    return `
      <section class="storage-card storage-error">
        <div>
          <p class="kicker">${label("Armazenamento", "Storage")}</p>
          <h3>${label("Não foi possível estimar o uso", "Could not estimate usage")}</h3>
          <p>${escapeHtml(storage.error || label("Erro ao ler a pasta de imagens.", "Error reading the images folder."))}</p>
        </div>
      </section>
    `;
  }

  const bytes = Number(storage.bytes) || 0;
  const fileCount = Number(storage.fileCount) || 0;
  const level = getStorageLevel(bytes);
  const limit = getStorageLimitForProgress(bytes);
  const progress = Math.min(100, Math.round((bytes / limit) * 100));
  const copy = getStorageCopy(bytes);
  const remainingSafe = Math.max(0, SAFE_STORAGE_BYTES - bytes);

  return `
    <section class="storage-card storage-${level}">
      <div class="storage-info">
        <p class="kicker">${label("Armazenamento seguro", "Safe storage")}</p>
        <h3>${copy.title}</h3>
        <p>${copy.message}</p>
        <p class="storage-note">
          ${label("Estimativa baseada nos arquivos dentro de", "Estimate based on files inside")}
          <code>${escapeHtml(root)}/</code> · ${fileCount} ${label("arquivo(s)", "file(s)")}
        </p>
      </div>

      <div class="storage-meter-wrap">
        <div class="storage-total"><strong>${formatBytes(bytes)}</strong> ${label("usados", "used")}</div>
        <div class="storage-meter" aria-label="${attr(label("Uso de armazenamento", "Storage usage"))}">
          <span style="--storage-progress: ${progress}%"></span>
        </div>
        <div class="storage-scale">
          <span>${formatBytes(remainingSafe)} ${label("até 1 GB seguro", "until safe 1 GB")}</span>
          <span>${formatBytes(limit)} ${copy.limitLabel}</span>
        </div>
      </div>
    </section>
  `;
}

function renderEmptyDashboard() {
  return `
    <div class="empty-state">
      <h3>${t("noJsonFound")}</h3>
      <p>${t("noJsonFoundDescription")}</p>
      <div class="row-actions" style="justify-content: center;">
        <button class="btn primary" id="empty-new-btn">${label("Novo Mangá", "New Manga")}</button>
        <button class="btn ghost" id="empty-change-repo-btn">${label("Trocar Repo", "Change Repo")}</button>
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
            <th>${label("Capítulos", "Chapters")}</th>
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
            <span class="manga-mobile-meta">${chapters} ${label("Capítulos", "Chapters")}</span>
          </div>
        </div>
      </td>
      <td><span class="file-name">${escapeHtml(file.name)}</span></td>
      <td>${chapters}</td>
      <td>
        <div class="manga-actions compact-actions">
          <button class="btn primary small" data-open-file="${index}" ${file.data ? "" : "disabled"}>${t("edit")}</button>
          <button class="btn ghost small" data-copy-cubari="${index}">${t("copyCubari")}</button>
        </div>
      </td>
    </tr>
  `;
}
