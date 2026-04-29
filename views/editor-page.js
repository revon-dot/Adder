import { escapeHtml, attr } from "../utils.js";
import { repoLabel, cubariUrlForPath } from "../repo.js";
import { renderChapterCards } from "./editor-renderers.js";

function renderSavedLinks(current) {
  if (current.isNew || !current.path) return "";
  const cubariUrl = cubariUrlForPath(current.path);
  const githubUrl = current.htmlUrl || "";
  return `
    <section class="notice editor-links" id="saved-links-panel">
      <strong>Arquivo salvo:</strong>
      <span>${escapeHtml(current.path)}</span>
      <div class="row-actions">
        ${githubUrl ? `<a class="btn ghost small" href="${attr(githubUrl)}" target="_blank" rel="noreferrer">Abrir no GitHub</a>` : ""}
        ${cubariUrl ? `<button class="btn ghost small" type="button" id="copy-editor-cubari-btn" data-cubari-url="${attr(cubariUrl)}">Copiar Cubari</button>` : ""}
        ${current.downloadUrl ? `<button class="btn ghost small" type="button" id="copy-editor-raw-btn" data-raw-url="${attr(current.downloadUrl)}">Copiar raw</button>` : ""}
      </div>
    </section>
  `;
}

export function renderEditorPage(current, manifest) {
  return `
    <header class="editor-header dashboard-compact">
      <div class="dashboard-main">
        <div class="dashboard-title-wrap">
          <div class="dashboard-logo">A</div>
          <div>
            <p class="kicker">Editor</p>
            <h2>${escapeHtml(manifest.title || "Novo mangá")}</h2>
          </div>
        </div>

        <div class="dashboard-status-row">
          <span class="status-pill"><span class="status-dot"></span>${escapeHtml(repoLabel())}</span>
          <span class="mini-stat"><strong id="stat-chapters">0</strong> capítulos</span>
          <span class="mini-stat"><strong id="stat-groups">0</strong> grupos</span>
          <span class="mini-stat"><strong id="stat-images">0</strong> imagens</span>
        </div>
      </div>

      <div class="toolbar dashboard-toolbar">
        <button class="btn primary" id="save-btn">Salvar no GitHub</button>
        <button class="btn ghost" id="preview-json-btn">Pré-visualizar JSON</button>
        <button class="btn ghost" id="back-dashboard-btn">Dashboard</button>
      </div>
    </header>
    
    <section class="panel editor-panel">
      ${renderSavedLinks(current)}
      <form id="editor-form" class="form-grid editor-form-block">
        <div class="field group">
          <label class="field">
            <span>Nome do arquivo</span>
            <input name="fileName" value="${attr(current.name)}" placeholder="manga.json" />
            <p class="hint">Mantenha o mesmo nome para atualizar o JSON atual. Use .json no final.</p>
          </label>
          <label class="field">
            <span>Título</span>
            <input name="title" value="${attr(manifest.title)}" placeholder="Título do mangá" />
          </label>
          <label class="field">
            <span>Descrição</span>
            <textarea name="description" placeholder="Descrição do mangá">${attr(manifest.description)}</textarea>
          </label>
        </div>
        
        <div class="field group">
          <label class="field">
            <span>Artista</span>
            <input name="artist" value="${attr(manifest.artist)}" placeholder="Nome do artista" />
          </label>
          <label class="field">
            <span>Autor</span>
            <input name="author" value="${attr(manifest.author)}" placeholder="Nome do autor" />
          </label>
          <label class="field">
            <span>Capa</span>
            <input name="cover" value="${attr(manifest.cover)}" placeholder="URL da imagem de capa" />
          </label>
        </div>
      </form>
      
      <div class="editor-chapter-actions">
        <button class="btn primary" id="add-chapter-btn">Adicionar capítulo</button>
      </div>
      
      <section class="panel" id="chapters-list">
        ${renderChapterCards(manifest)}
      </section>
    </section>
  `;
}
