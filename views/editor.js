import { state } from "../state.js";
import { render } from "../ui.js";
import { escapeHtml, attr } from "../utils.js";
import { githubPath } from "../github.js";
import { countGroups, countImages, emptyManifest, normalizeManifest } from "../cubari.js";
import { collectManifestFromEditor } from "../editor-collector.js";
import { repoLabel } from "../repo.js";
import { showJsonModal, showAddChapterModal } from "../modals.js";
import { renderChapterCards, renderChapterCard } from "./editor-renderers.js";
import { saveCurrentEditor } from "./editor-save.js";
import { bindChapterButtons } from "./editor-events.js";

export function openEditor(file, navigateToDashboard) {
  if (!file) {
    // New manifest
    const data = emptyManifest();
    state.current = {
      isNew: true,
      name: "novo-manga.json",
      path: githubPath.joinPath(state.config.jsonPath, "novo-manga.json"),
      sha: null,
      data,
    };
  } else {
    state.current = {
      isNew: false,
      name: file.name,
      path: file.path,
      sha: file.sha,
      data: structuredClone(file.data),
    };
  }
  renderEditor(navigateToDashboard);
}

export function renderEditor(navigateToDashboard) {
  const current = state.current;
  const manifest = normalizeManifest(current.data || emptyManifest());
  
  render(`
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
      <form id="editor-form" class="form-grid">
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
        </div>
        
        <div class="field group">
          <label class="field">
            <span>Capa</span>
            <input name="cover" value="${attr(manifest.cover)}" placeholder="URL da imagem de capa" />
          </label>
          <div id="preview-cover" class="cover-preview">
            ${manifest.cover ? `<img src="${attr(manifest.cover)}" alt="Capa" onerror="this.parentElement.innerHTML='<div class=&quot;cover-placeholder&quot;>Erro ao carregar capa</div>'" />` : `<div class="cover-placeholder">Sem capa</div>`}
          </div>
        </div>
      </form>
      
      <div class="editor-stats">
        <button class="btn primary" id="add-chapter-btn">Adicionar capítulo</button>
      </div>
      
      <section class="panel" id="chapters-list">
        ${renderChapterCards(manifest)}
      </section>
    </section>
  `);

  bindEditorEvents(navigateToDashboard);
}

function bindEditorEvents(navigateToDashboard) {
  document.querySelector("#back-dashboard-btn").addEventListener("click", navigateToDashboard);
  document.querySelector("#save-btn").addEventListener("click", () => saveCurrentEditor(navigateToDashboard, renderEditor));
  document.querySelector("#preview-json-btn").addEventListener("click", () => {
    const result = collectManifestFromEditor();
    if (result) showJsonModal(result.manifest);
  });
  document.querySelector("#add-chapter-btn").addEventListener("click", () => showAddChapterModal(renderChapterCard, (scope) => bindChapterButtons(scope, updateEditorStats), updateEditorStats));

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", updateEditorStats);
  document.querySelector("#chapters-list")?.addEventListener("input", updateEditorStats);

  bindChapterButtons(document, updateEditorStats);
  updateEditorStats();
}

export function updateEditorStats() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return;
  const { manifest } = result;
  const chapters = Object.keys(manifest.chapters || {}).length;
  const groups = countGroups(manifest);
  const images = countImages(manifest);

  const statChapters = document.querySelector("#stat-chapters");
  const statGroups = document.querySelector("#stat-groups");
  const statImages = document.querySelector("#stat-images");
  if (statChapters) statChapters.textContent = String(chapters);
  if (statGroups) statGroups.textContent = String(groups);
  if (statImages) statImages.textContent = String(images);

  const coverValue = document.querySelector("input[name='cover']")?.value.trim();
  const preview = document.querySelector("#preview-cover");
  if (preview) {
    preview.innerHTML = coverValue
      ? `<img src="${attr(coverValue)}" alt="Capa" onerror="this.parentElement.innerHTML='<div class=&quot;cover-placeholder&quot;>Sem capa</div>'" />`
      : `<div class="cover-placeholder">Sem capa</div>`;
  }
}
