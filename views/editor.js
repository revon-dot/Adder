import { state, getSavedImgChestToken } from "../state.js";
import { render, setBusy, toast, errorMessage } from "../ui.js";
import { escapeHtml, attr } from "../utils.js";
import { githubPath, rawGitHubUrl } from "../github.js";
import { 
  countGroups, 
  countImages, 
  emptyChapter, 
  emptyManifest, 
  normalizeManifest, 
  sortChapterEntries, 
  prettyJson 
} from "../cubari.js";
import { 
  repoLabel, 
  ensureClient, 
  cubariUrlForPath, 
  copyText, 
  collectManifestFromEditor 
} from "../helpers.js";
import { showJsonModal, showValidationModal, showAddChapterModal } from "../modals.js";
import { scrapeImgChestAlbum, extractImgChestLinksFromText } from "../imgchest.js";

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

function renderChapterCards(manifest) {
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

function bindEditorEvents(navigateToDashboard) {
  document.querySelector("#back-dashboard-btn").addEventListener("click", navigateToDashboard);
  document.querySelector("#save-btn").addEventListener("click", () => saveCurrentEditor(navigateToDashboard));
  document.querySelector("#preview-json-btn").addEventListener("click", () => {
    const result = collectManifestFromEditor();
    if (result) showJsonModal(result.manifest);
  });
  document.querySelector("#add-chapter-btn").addEventListener("click", () => showAddChapterModal(renderChapterCard, bindChapterButtons, updateEditorStats));

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", updateEditorStats);
  document.querySelector("#chapters-list")?.addEventListener("input", updateEditorStats);

  bindChapterButtons();
  updateEditorStats();
}

export function bindChapterButtons(scope = document) {
  scope.querySelectorAll("[data-toggle-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const card = button.closest("[data-chapter-card]");
      const content = card.querySelector("[data-groups-list]");
      content.classList.toggle("collapsed");
      button.textContent = content.classList.contains("collapsed") ? "Expandir" : "Alternar";
    });
  });

  scope.querySelectorAll("[data-remove-chapter]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      if (!confirm("Remover este capítulo?")) return;
      button.closest("[data-chapter-card]")?.remove();
      updateEditorStats();
    });
  });

  scope.querySelectorAll("[data-remove-group]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const chapter = button.closest("[data-chapter-card]");
      const groups = chapter.querySelectorAll("[data-group-card]");
      if (groups.length <= 1) {
        toast("O capítulo precisa ter pelo menos um grupo.", "error");
        return;
      }
      button.closest("[data-group-card]")?.remove();
      updateEditorStats();
    });
  });

  scope.querySelectorAll("[data-import-imgchest]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", async () => importImgChestIntoGroup(button));
  });

  scope.querySelectorAll("[data-extract-imgchest]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => extractImgChestFromTextarea(button));
  });
}

async function importImgChestIntoGroup(button) {
  const groupCard = button.closest("[data-group-card]");
  const input = groupCard?.querySelector("[data-imgchest-url]");
  const textarea = groupCard?.querySelector("[data-group-images]");
  const albumUrl = input?.value.trim();

  if (!albumUrl) {
    toast("Cole a URL do álbum ImgChest primeiro.", "error");
    return;
  }

  let token = state.config?.imgchestToken || getSavedImgChestToken();
  if (!token) {
    token = prompt("Opcional: cole seu ImgChest API token para importar pelo endpoint oficial. Se deixar vazio, vou tentar ler a página pública, mas o navegador pode bloquear.") || "";
    if (token && state.config) state.config.imgchestToken = token.trim();
  }

  try {
    setBusy(true);
    button.disabled = true;
    button.textContent = "Importando...";
    const links = await scrapeImgChestAlbum(albumUrl, { token });
    if (!links.length) {
      toast("Nenhuma imagem encontrada no álbum.", "error");
      return;
    }
    textarea.value = links.join("\n");
    toast(`${links.length} imagens importadas do ImgChest.`, "success");
    updateEditorStats();
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    button.textContent = "Importar ImgChest";
    button.disabled = false;
    setBusy(false);
  }
}

function extractImgChestFromTextarea(button) {
  const groupCard = button.closest("[data-group-card]");
  const textarea = groupCard?.querySelector("[data-group-images]");
  const links = extractImgChestLinksFromText(textarea?.value || "");
  if (!links.length) {
    toast("Não encontrei URLs cdn.imgchest.com no texto colado.", "error");
    return;
  }
  textarea.value = links.join("\n");
  toast(`${links.length} URLs ImgChest extraídas.`, "success");
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

async function saveCurrentEditor(navigateToDashboard) {
   const result = collectManifestFromEditor();
   if (!result) return;
   const { manifest, fileName, validation } = result;
   if (validation.errors.length) {
     showValidationModal(validation);
     return;
   }

   if (validation.warnings.length) {
     const ok = confirm(`Avisos encontrados:\n\n${validation.warnings.slice(0, 6).join("\n")}\n\nSalvar mesmo assim?`);
     if (!ok) return;
   }

   const client = ensureClient();
   const oldPath = state.current.path;
   const desiredPath = githubPath.joinPath(state.config.jsonPath, fileName);
   const isRenamingExisting = !state.current.isNew && oldPath !== desiredPath;

   if (isRenamingExisting) {
     const ok = confirm("Você mudou o nome do arquivo. O Adder Pages vai criar/atualizar o novo arquivo, mas não apaga automaticamente o antigo. Continuar?");
     if (!ok) return;
   }

   const message = `${state.current.isNew ? "Create" : "Update"} ${fileName} via Adder Pages`;

   try {
     setBusy(true);
     const saveResult = await client.putFile({
       ...state.config,
       path: desiredPath,
       text: prettyJson(manifest),
       message,
       sha: isRenamingExisting || state.current.isNew ? undefined : state.current.sha,
     });

     state.current = {
       isNew: false,
       name: fileName,
       path: desiredPath,
       sha: saveResult.content?.sha,
       data: manifest,
     };

     const existingIndex = state.files.findIndex((file) => file.path === desiredPath || file.path === oldPath);
     const record = {
       name: fileName,
       path: desiredPath,
       sha: saveResult.content?.sha,
       htmlUrl: saveResult.content?.html_url,
       downloadUrl: saveResult.content?.download_url,
       data: manifest,
     };
     if (existingIndex >= 0) state.files[existingIndex] = record;
     else state.files.push(record);

     toast("JSON salvo no GitHub.", "success");
     renderEditor(navigateToDashboard);
   } catch (error) {
     toast(errorMessage(error), "error");
   } finally {
     setBusy(false);
   }
}
