import { escapeHtml } from "../utils.js";
import { countImages, sortChapterEntries } from "../cubari.js";

function countChapterGroups(chapter = {}) {
  return Object.keys(chapter.groups || {}).length;
}

function countChapterImages(chapter = {}) {
  return countImages({ chapters: { current: chapter } });
}

export function renderChapterCards(manifest) {
  const entries = sortChapterEntries(manifest.chapters || {});
  if (!entries.length) {
    return `
      <div class="empty-state" id="no-chapters-state">
        <h3>Nenhum capítulo ainda</h3>
        <p>Clique em “Adicionar capítulo” para começar.</p>
      </div>
    `;
  }

  return `
    <div class="chapter-list" data-chapter-list>
      ${entries.map(([number, chapter]) => renderChapterRow(number, chapter)).join("")}
    </div>
  `;
}

export function renderChapterRow(number, chapter = {}) {
  const title = chapter.title || "Sem título";
  const groups = countChapterGroups(chapter);
  const images = countChapterImages(chapter);
  return `
    <article class="chapter-row" data-chapter-card data-chapter-number="${escapeHtml(number)}">
      <div class="chapter-row-main">
        <span class="badge">${escapeHtml(number)}</span>
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="card-meta">${groups} grupos · ${images} imagens · volume ${escapeHtml(chapter.volume || "-")}</p>
        </div>
      </div>
      <div class="chapter-actions">
        <button class="btn primary small" type="button" data-edit-chapter="${escapeHtml(number)}">Editar</button>
        <button class="btn danger small" type="button" data-remove-chapter="${escapeHtml(number)}">Remover</button>
      </div>
    </article>
  `;
}

export const renderChapterCard = renderChapterRow;
