import { escapeHtml, attr } from "../utils.js";
import { emptyChapter, sortChapterEntries } from "../cubari.js";

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

  return entries.map(([number, chapter]) => renderChapterCard(number, chapter)).join("");
}

export function renderChapterCard(number, chapter) {
  const safeChapter = { ...emptyChapter(), ...chapter };
  return `
    <article class="chapter-card" data-chapter-card>
      <div class="chapter-top">
        <div class="chapter-title-row">
          <span class="badge">${escapeHtml(number)}</span>
          <h3>Capítulo</h3>
        </div>
        <div class="chapter-actions">
          <button class="btn ghost small" type="button" data-toggle-chapter>Alternar</button>
          <button class="btn danger small" type="button" data-remove-chapter>Remover capítulo</button>
        </div>
      </div>

      <div class="form-grid">
        <label class="field">
          <span>Número</span>
          <input data-chapter-number value="${attr(number)}" placeholder="1" required />
        </label>
        <label class="field">
          <span>Título do capítulo</span>
          <input data-chapter-title value="${attr(safeChapter.title)}" placeholder="Capítulo 1" />
        </label>
        <label class="field">
          <span>Volume</span>
          <input data-chapter-volume value="${attr(safeChapter.volume)}" placeholder="opcional" />
        </label>
        <label class="field">
          <span>Last updated</span>
          <input data-chapter-updated value="${attr(safeChapter.last_updated || Math.floor(Date.now() / 1000))}" placeholder="timestamp" />
        </label>
      </div>

      <div data-groups-list class="chapter-content">
        ${Object.entries(safeChapter.groups || { "": [] }).map(([groupName, images]) => renderGroupCard(groupName, images)).join("")}
      </div>
    </article>
  `;
}

function renderGroupCard(groupName = "", images = []) {
  const text = Array.isArray(images) ? images.join("\n") : String(images || "");
  return `
    <section class="group-card" data-group-card>
      <div class="group-header">
        <label class="field" style="flex: 1;">
          <span>Nome do grupo</span>
          <input data-group-name value="${attr(groupName)}" placeholder="vazio = grupo sem nome" />
        </label>
        <button class="btn danger small" type="button" data-remove-group>Remover grupo</button>
      </div>
      <div class="imgchest-tools">
        <label class="field imgchest-url-field">
          <span>ImgChest album URL</span>
          <input data-imgchest-url placeholder="https://imgchest.com/p/..." />
        </label>
        <div class="inline-tools">
          <button class="btn ghost small" type="button" data-import-imgchest>Importar ImgChest</button>
          <button class="btn ghost small" type="button" data-extract-imgchest>Extrair URLs coladas</button>
        </div>
      </div>
      <label class="field">
        <span>URLs das imagens</span>
        <textarea data-group-images placeholder="Cole uma URL por linha">${escapeHtml(text)}</textarea>
      </label>
    </section>
  `;
}
