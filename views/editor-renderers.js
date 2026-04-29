import { state } from "../state.js";
import { escapeHtml, attr } from "../utils.js";
import { sortChapterEntries } from "../cubari.js";
import { t } from "../i18n.js";

function countChapterGroups(chapter = {}) {
  return Object.keys(chapter.groups || {}).length;
}

function countChapterImages(chapter = {}) {
  return Object.values(chapter.groups || {}).reduce((total, images) => {
    return total + (Array.isArray(images) ? images.length : 0);
  }, 0);
}

function filteredChapterEntries(manifest) {
  const query = state.editor.chapterSearch.trim().toLowerCase();
  return sortChapterEntries(manifest.chapters || {}).filter(([number, chapter]) => {
    if (!query) return true;
    return `${number} ${chapter.title || ""}`.toLowerCase().includes(query);
  });
}

function getChapterPage(entries) {
  const pageSize = state.editor.chapterPageSize;
  const effectivePageSize = pageSize === "all" ? Math.max(1, entries.length) : Number(pageSize) || 10;
  const totalPages = Math.max(1, Math.ceil(entries.length / effectivePageSize));
  state.editor.chapterPage = Math.min(Math.max(1, state.editor.chapterPage), totalPages);
  const start = (state.editor.chapterPage - 1) * effectivePageSize;
  return {
    totalPages,
    visibleEntries: entries.slice(start, start + effectivePageSize),
  };
}

function renderChapterPageSizeSelect() {
  const current = String(state.editor.chapterPageSize || 10);
  const isEnglish = document.documentElement.lang === "en";
  const prefix = isEnglish ? "Show" : "Exibir";
  const allLabel = isEnglish ? "all" : "todos";
  const ariaLabel = isEnglish ? "Chapters per page" : "Capítulos por página";
  const options = [
    ["10", `${prefix} 10`],
    ["25", `${prefix} 25`],
    ["50", `${prefix} 50`],
    ["all", `${prefix} ${allLabel}`],
  ];

  return `
    <label class="chapter-page-size-control">
      <select id="chapter-page-size-select" data-keep-enabled="true" aria-label="${attr(ariaLabel)}">
        ${options.map(([value, label]) => `<option value="${attr(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}
      </select>
    </label>
  `;
}

export function renderChapterCards(manifest) {
  const allEntries = sortChapterEntries(manifest.chapters || {});
  if (!allEntries.length) {
    return `
      <div class="empty-state" id="no-chapters-state">
        <h3>${t("noChapters")}</h3>
        <p>${t("noChaptersDescription")}</p>
      </div>
    `;
  }

  const entries = filteredChapterEntries(manifest);
  const { totalPages, visibleEntries } = getChapterPage(entries);

  return `
    <div class="chapter-manager">
      <div class="chapter-toolbar-light">
        <input id="chapter-search-input" data-keep-enabled="true" value="${attr(state.editor.chapterSearch)}" placeholder="${attr(t("chapterSearchPlaceholder"))}" />
        <div class="chapter-toolbar-meta">
          ${renderChapterPageSizeSelect()}
          <span class="chapter-count">${entries.length} / ${allEntries.length} ${t("chapters")}</span>
        </div>
      </div>

      ${visibleEntries.length ? renderChapterTable(visibleEntries) : renderNoResults()}

      <div class="chapter-pagination">
        <button class="btn ghost small" type="button" data-chapter-page="prev" ${state.editor.chapterPage <= 1 ? "disabled" : ""}>${t("previous")}</button>
        <span>${t("page")} ${state.editor.chapterPage} ${t("of")} ${totalPages}</span>
        <button class="btn ghost small" type="button" data-chapter-page="next" ${state.editor.chapterPage >= totalPages ? "disabled" : ""}>${t("next")}</button>
      </div>
    </div>
  `;
}

function renderNoResults() {
  return `
    <div class="empty-state compact-empty">
      <h3>${t("noChapterFound")}</h3>
      <p>${t("noChapterFoundDescription")}</p>
    </div>
  `;
}

function renderChapterTable(entries) {
  return `
    <div class="chapter-table-wrap">
      <table class="chapter-table">
        <thead>
          <tr>
            <th>${t("numberAbbr")}</th>
            <th>${t("title")}</th>
            <th>${t("volume")}</th>
            <th>${t("groups")}</th>
            <th>${t("images")}</th>
            <th>${t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(([number, chapter]) => renderChapterRow(number, chapter)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function renderChapterRow(number, chapter = {}) {
  return `
    <tr data-chapter-card data-chapter-number="${escapeHtml(number)}">
      <td><span class="badge small-badge">${escapeHtml(number)}</span></td>
      <td>
        <strong>${escapeHtml(chapter.title || t("untitled"))}</strong>
        <span class="chapter-mobile-meta">${countChapterGroups(chapter)} ${t("groups")} · ${countChapterImages(chapter)} ${t("images")}</span>
      </td>
      <td>${escapeHtml(chapter.volume || "-")}</td>
      <td>${countChapterGroups(chapter)}</td>
      <td>${countChapterImages(chapter)}</td>
      <td>
        <div class="chapter-actions compact-actions">
          <button class="btn primary small" type="button" data-edit-chapter="${escapeHtml(number)}">${t("edit")}</button>
          <button class="btn danger small" type="button" data-remove-chapter="${escapeHtml(number)}">${t("remove")}</button>
        </div>
      </td>
    </tr>
  `;
}

export const renderChapterCard = renderChapterRow;
