import { GitHubClient, githubPath, rawGitHubUrl } from "./github.js";
import {
  countGroups,
  countImages,
  emptyChapter,
  emptyManifest,
  normalizeManifest,
  buildCubariGistUrl,
  prettyJson,
  sanitizeFileName,
  sortChapterEntries,
  validateManifest,
} from "./cubari.js";
import { extractImgChestLinksFromText, scrapeImgChestAlbum } from "./imgchest.js";

const STORAGE_KEY = "adder-pages:v1";
const TOKEN_KEY = "adder-pages:token";
const IMG_TOKEN_KEY = "adder-pages:imgchest-token";
const FINE_GRAINED_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=Adder%20Pages&description=Editar%20JSONs%20Cubari%20via%20Adder%20Pages&expires_in=90&contents=write";

const app = document.querySelector("#app");
const state = {
  client: null,
  config: null,
  files: [],
  current: null,
  search: "",
  busy: false,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function attr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function render(markup) {
  app.innerHTML = `<div class="app-shell">${markup}</div>`;
}

function setBusy(isBusy) {
  state.busy = isBusy;
  document.querySelectorAll("button, input, textarea, select").forEach((element) => {
    if (element.dataset.keepEnabled === "true") return;
    if (element.matches("button")) element.disabled = isBusy;
  });
}

function toast(message, type = "") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const node = document.createElement("div");
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function errorMessage(error) {
  if (!error) return "Erro desconhecido.";
  if (error.status === 401) return "Token inválido ou expirado. Confira o Personal Access Token.";
  if (error.status === 403) return "Acesso negado. Confira se o token tem permissão de leitura/escrita no repositório.";
  if (error.status === 404) return "Repositório, branch, pasta ou arquivo não encontrado.";
  if (error.status === 409) return "Conflito ao salvar. Atualize a lista e tente novamente.";
  return error.message || String(error);
}

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveConfig(config, rememberToken, rememberImgChestToken = false) {
  const safeConfig = { ...config };
  delete safeConfig.token;
  delete safeConfig.imgchestToken;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
  if (rememberToken) {
    localStorage.setItem(TOKEN_KEY, config.token || "");
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (rememberImgChestToken) {
    localStorage.setItem(IMG_TOKEN_KEY, config.imgchestToken || "");
  } else {
    localStorage.removeItem(IMG_TOKEN_KEY);
  }
}

function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IMG_TOKEN_KEY);
}

function getSavedToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getSavedImgChestToken() {
  return localStorage.getItem(IMG_TOKEN_KEY) || "";
}

function ensureClient() {
  if (!state.config) throw new Error("Configuração ausente.");
  state.client = new GitHubClient(state.config.token);
  return state.client;
}

function repoLabel() {
  if (!state.config) return "";
  const path = state.config.jsonPath ? `/${state.config.jsonPath}` : "";
  return `${state.config.owner}/${state.config.repo} · ${state.config.branch}${path}`;
}

function cubariUrlForPath(path) {
  if (!state.config || !path) return "";
  return buildCubariGistUrl({
    owner: state.config.owner,
    repo: state.config.repo,
    branch: state.config.branch,
    path,
  });
}

function renderLanding() {
  const saved = loadSavedConfig();
  const hasToken = Boolean(getSavedToken());
  render(`
    <section class="hero">
      <div class="hero-content">
        <p class="kicker">Adder Pages</p>
        <h1>Editor Cubari direto no GitHub Pages.</h1>
        <p class="lead">
          Uma versão estática do Adder: você edita JSONs de mangás, capítulos, grupos e imagens pelo navegador, e salva direto no repositório usando a API do GitHub.
        </p>
        <div class="hero-actions">
          <button class="btn primary" id="begin-btn">Começar</button>
          <button class="btn ghost" id="load-saved-btn" ${saved ? "" : "disabled"}>Carregar dados Salvos</button>
        </div>
        <p class="footer-note">
          ${saved ? `Config salva: <strong>${escapeHtml(saved.owner)}/${escapeHtml(saved.repo)}</strong>${hasToken ? " · token salvo neste navegador" : " · token não salvo"}` : "Nenhuma configuração salva neste navegador."}
        </p>
      </div>
    </section>
  `);

  document.querySelector("#begin-btn").addEventListener("click", () => renderConnect(saved || {}));
  document.querySelector("#load-saved-btn")?.addEventListener("click", () => {
    const config = loadSavedConfig();
    if (!config) return renderConnect({});
    renderConnect({ ...config, token: getSavedToken(), imgchestToken: getSavedImgChestToken() });
  });
}

function renderConnect(prefill = {}) {
  const token = prefill.token || "";
  const imgchestToken = prefill.imgchestToken || getSavedImgChestToken();
  render(`
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="kicker">Conexão</p>
          <h2>Conectar ao repositório</h2>
          <p>Preencha os dados do GitHub. O site é estático: tudo roda no navegador e o salvamento acontece pela API do GitHub.</p>
        </div>
        <button class="btn ghost" id="back-home-btn">Voltar</button>
      </div>

      <div class="notice">
        <strong>Segurança:</strong> use um fine-grained Personal Access Token limitado apenas ao repositório que você quer editar. Marque “lembrar token” só em computador confiável.
      </div>

      <details class="guide-card" open>
        <summary>Como criar o Personal Access Token</summary>
        <div class="guide-content">
          <p>Use um <strong>Fine-grained token</strong>. Ele é mais seguro porque pode ficar limitado a um único repositório e só às permissões necessárias.</p>

          <a class="btn primary guide-link" href="${FINE_GRAINED_TOKEN_URL}" target="_blank" rel="noreferrer">Abrir criação do token no GitHub</a>

          <ol class="guide-steps">
            <li>Entre na sua conta do GitHub.</li>
            <li>Clique no botão acima ou vá em <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</strong>.</li>
            <li>Em <strong>Token name</strong>, coloque algo como <code>Adder Pages</code>.</li>
            <li>Em <strong>Expiration</strong>, escolha uma validade. Exemplo: <code>90 days</code>.</li>
            <li>Em <strong>Resource owner</strong>, escolha o dono do repositório: sua conta ou organização.</li>
            <li>Em <strong>Repository access</strong>, escolha <strong>Only select repositories</strong> e selecione apenas o repositório dos JSONs.</li>
            <li>Em <strong>Repository permissions</strong>, procure <strong>Contents</strong> e marque <strong>Read and write</strong>. O <strong>Metadata</strong> fica como leitura automaticamente.</li>
            <li>Clique em <strong>Generate token</strong>.</li>
            <li>Copie o token gerado e cole no campo <strong>Personal Access Token</strong> abaixo. O GitHub só mostra esse token uma vez.</li>
          </ol>

          <div class="copy-box">
            <strong>Permissão mínima para este site:</strong> Repository permissions → Contents → Read and write.
          </div>
        </div>
      </details>

      <form id="connect-form" class="form-grid" autocomplete="off">
        <label class="field">
          <span>GitHub username</span>
          <input name="username" value="${attr(prefill.username || prefill.owner || "")}" placeholder="seuusuario" required />
          <p class="hint">Usado só como identificação visual. O owner do repositório pode ser diferente.</p>
        </label>

        <label class="field">
          <span>Personal Access Token</span>
          <input name="token" value="${attr(token)}" placeholder="github_pat_..." type="password" required />
          <p class="hint">Precisa conseguir ler e escrever conteúdo no repositório.</p>
        </label>

        <label class="field">
          <span>Repository owner</span>
          <input name="owner" value="${attr(prefill.owner || prefill.username || "")}" placeholder="seuusuario-ou-org" required />
        </label>

        <label class="field">
          <span>Repository name</span>
          <input name="repo" value="${attr(prefill.repo || "")}" placeholder="meus-jsons-cubari" required />
        </label>

        <label class="field">
          <span>Branch</span>
          <input name="branch" value="${attr(prefill.branch || "main")}" placeholder="main" required />
        </label>

        <label class="field">
          <span>Pasta dos JSONs</span>
          <input name="jsonPath" value="${attr(prefill.jsonPath || "")}" placeholder="vazio = raiz do repositório" />
          <p class="hint">Exemplo: <code>series</code>, <code>json</code> ou deixe vazio para usar a raiz.</p>
        </label>

        <details class="guide-card span-2">
          <summary>ImgChest scraper opcional</summary>
          <div class="guide-content">
            <p>Para importar imagens direto de um álbum ImgChest no GitHub Pages, o jeito mais estável é usar o endpoint oficial do ImgChest com um API token do ImgChest. Sem token, o app ainda tenta ler a página pública, mas o navegador pode bloquear por CORS.</p>
            <label class="field">
              <span>ImgChest API token</span>
              <input name="imgchestToken" value="${attr(imgchestToken)}" placeholder="opcional" type="password" />
              <p class="hint">Esse token é diferente do token do GitHub. Ele só é usado na função “Importar ImgChest”.</p>
            </label>
            <label class="checkbox-row">
              <input name="rememberImgchestToken" type="checkbox" ${imgchestToken ? "checked" : ""} />
              <span>Lembrar ImgChest token neste navegador</span>
            </label>
          </div>
        </details>

        <label class="checkbox-row span-2">
          <input name="rememberToken" type="checkbox" ${token ? "checked" : ""} />
          <span>Lembrar token do GitHub neste navegador</span>
        </label>

        <div class="form-actions span-2">
          <button class="btn primary" type="submit">Conectar</button>
          <button class="btn ghost" type="button" id="clear-saved-btn">Limpar dados salvos</button>
        </div>
      </form>
    </section>
  `);

  document.querySelector("#back-home-btn").addEventListener("click", renderLanding);
  document.querySelector("#clear-saved-btn").addEventListener("click", () => {
    clearSaved();
    toast("Dados salvos apagados.", "success");
    renderConnect({});
  });

  document.querySelector("#connect-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config = {
      username: String(form.get("username") || "").trim(),
      token: String(form.get("token") || "").trim(),
      owner: String(form.get("owner") || "").trim(),
      repo: String(form.get("repo") || "").trim(),
      branch: String(form.get("branch") || "main").trim(),
      jsonPath: githubPath.stripSlashes(String(form.get("jsonPath") || "")),
      imgchestToken: String(form.get("imgchestToken") || "").trim(),
    };

    try {
      setBusy(true);
      state.config = config;
      const client = ensureClient();
      await client.getRepo(config);
      saveConfig(config, Boolean(form.get("rememberToken")), Boolean(form.get("rememberImgchestToken")));
      toast("Conectado ao repositório.", "success");
      await loadDashboard();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
}

function renderLoading(text = "Carregando...") {
  render(`
    <section class="panel loading">
      <div>
        <div class="spinner"></div>
        <h2>${escapeHtml(text)}</h2>
        <p>${escapeHtml(repoLabel())}</p>
      </div>
    </section>
  `);
}

async function loadDashboard() {
  renderLoading("Lendo arquivos JSON...");
  const client = ensureClient();
  const config = state.config;
  const jsonFiles = await client.listJsonFiles(config);
  const loaded = [];

  for (const file of jsonFiles) {
    try {
      const fetched = await client.getFile({ ...config, path: file.path });
      const parsed = normalizeManifest(JSON.parse(fetched.text));
      loaded.push({
        name: file.name,
        path: file.path,
        sha: fetched.sha,
        htmlUrl: fetched.html_url,
        downloadUrl: fetched.download_url,
        data: parsed,
      });
    } catch (error) {
      loaded.push({
        name: file.name,
        path: file.path,
        sha: file.sha,
        error: errorMessage(error),
        data: null,
      });
    }
  }

  state.files = loaded;
  renderDashboard();
}

function renderDashboard() {
  const totalChapters = state.files.reduce((sum, file) => sum + (file.data ? Object.keys(file.data.chapters || {}).length : 0), 0);
  const totalImages = state.files.reduce((sum, file) => sum + (file.data ? countImages(file.data) : 0), 0);
  const filtered = state.files.filter((file) => {
    const query = state.search.trim().toLowerCase();
    if (!query) return true;
    const title = file.data?.title || file.name;
    return `${title} ${file.name}`.toLowerCase().includes(query);
  });

  render(`
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

      ${filtered.length ? `<div class="cards-grid">${filtered.map(renderMangaCard).join("")}</div>` : renderEmptyDashboard()}
    </section>
  `);

  document.querySelector("#new-manga-btn").addEventListener("click", () => openNewManifest());
  document.querySelector("#refresh-btn").addEventListener("click", async () => {
    try {
      setBusy(true);
      await loadDashboard();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
  document.querySelector("#change-repo-btn").addEventListener("click", () => renderConnect({ ...state.config }));
  document.querySelector("#search-input").addEventListener("input", (event) => {
    state.search = event.currentTarget.value;
    renderDashboard();
  });

   document.querySelectorAll("[data-open-file]").forEach((button) => {
     button.addEventListener("click", () => {
       const file = state.files[Number(button.dataset.openFile)];
       if (file?.data) openEditor(file);
     });
   });

   document.querySelectorAll("[data-copy-cubari]").forEach((button) => {
     button.addEventListener("click", async () => {
       const file = state.files[Number(button.dataset.copyCubari)];
       if (!file) return;
       await copyText(cubariUrlForPath(file.path));
     });
   });
}

function renderEmptyDashboard() {
  return `
    <div class="empty-state">
      <h3>Nenhum JSON encontrado</h3>
      <p>Crie um novo mangá ou confira se a pasta dos JSONs está correta.</p>
      <button class="btn primary" id="empty-new-btn" onclick="document.querySelector('#new-manga-btn')?.click()">Criar primeiro JSON</button>
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

function openNewManifest() {
  const data = emptyManifest();
  state.current = {
    isNew: true,
    name: "novo-manga.json",
    path: githubPath.joinPath(state.config.jsonPath, "novo-manga.json"),
    sha: null,
    data,
  };
  renderEditor();
}

function openEditor(file) {
  state.current = {
    isNew: false,
    name: file.name,
    path: file.path,
    sha: file.sha,
    data: structuredClone(file.data),
  };
  renderEditor();
}

function renderEditor() {
  const current = state.current;
  const manifest = normalizeManifest(current.data || emptyManifest());
  const fileName = current.path.split("/").pop() || current.name;
  const rawUrl = !current.isNew ? rawGitHubUrl({ ...state.config, path: current.path }) : "";
  const cubariUrl = !current.isNew ? cubariUrlForPath(current.path) : "";

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
         </div>
       </div>

       <div class="toolbar dashboard-toolbar">
         <button class="btn primary" id="save-btn">Salvar no GitHub</button>
         <button class="btn ghost" id="preview-json-btn">Pré-visualizar JSON</button>
         <button class="btn ghost" id="back-dashboard-btn">Dashboard</button>
       </div>
     </header>
   `);

  bindEditorEvents();
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

function renderChapterCard(number, chapter) {
  const safeChapter = { ...emptyChapter(), ...chapter };
  return `
    <article class="chapter-card" data-chapter-card>
      <div class="chapter-top">
        <div class="chapter-title-row">
          <span class="badge">${escapeHtml(number)}</span>
          <h3>Capítulo</h3>
        </div>
        <div class="chapter-actions">
          <button class="btn ghost small" type="button" data-add-group>Adicionar grupo</button>
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

      <div data-groups-list>
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

function bindEditorEvents() {
  document.querySelector("#back-dashboard-btn").addEventListener("click", renderDashboard);
  document.querySelector("#save-btn").addEventListener("click", saveCurrentEditor);
  document.querySelector("#preview-json-btn").addEventListener("click", () => showJsonModal(collectManifestFromEditor().manifest));
  document.querySelector("#add-chapter-btn").addEventListener("click", () => addChapterCard());

  const coverInput = document.querySelector("input[name='cover']");
  coverInput?.addEventListener("input", () => updateEditorStats());
  document.querySelector("#editor-form")?.addEventListener("input", updateEditorStats);
  document.querySelector("#chapters-list")?.addEventListener("input", updateEditorStats);

   document.querySelector("#copy-raw-current-btn")?.addEventListener("click", async () => {
     await copyText(rawGitHubUrl({ ...state.config, path: state.current.path }));
   });
 
   document.querySelector("#copy-cubari-current-btn")?.addEventListener("click", async () => {
     await copyText(cubariUrlForPath(state.current.path));
   });
   
   document.querySelector("#delete-file-btn")?.addEventListener("click", async () => {
     await deleteCurrentFile();
   });

  bindChapterButtons();
  updateEditorStats();
}

function bindChapterButtons(scope = document) {
  scope.querySelectorAll("[data-add-group]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      const card = button.closest("[data-chapter-card]");
      const list = card.querySelector("[data-groups-list]");
      list.insertAdjacentHTML("beforeend", renderGroupCard("", []));
      bindChapterButtons(card);
      updateEditorStats();
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
    if (token) state.config.imgchestToken = token.trim();
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

function getNextChapterNumber() {
  const { manifest } = collectManifestFromEditor({ silent: true });
  const numbers = Object.keys(manifest.chapters || {})
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  return numbers.length ? String(Math.max(...numbers) + 1) : "1";
}

function addChapterCard() {
  showAddChapterModal();
}

function showAddChapterModal() {
  const next = getNextChapterNumber();
  const savedToken = state.config?.imgchestToken || getSavedImgChestToken();
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal-card add-chapter-modal">
      <div class="panel-header">
        <div>
          <p class="kicker">Novo capítulo</p>
          <h2>Adicionar capítulo com ImgChest</h2>
          <p>Funciona como o Adder local: informe número, título, volume, grupo e, se quiser, a URL do álbum ImgChest para importar as páginas.</p>
        </div>
        <button class="btn ghost" type="button" data-close-modal>Fechar</button>
      </div>

      <form id="add-chapter-modal-form" class="form-grid" autocomplete="off">
        <label class="field">
          <span>Número</span>
          <input name="number" value="${attr(next)}" placeholder="1" required />
        </label>
        <label class="field">
          <span>Título do capítulo</span>
          <input name="title" placeholder="Capítulo 1" />
        </label>
        <label class="field">
          <span>Volume</span>
          <input name="volume" value="1" placeholder="opcional" />
        </label>
        <label class="field">
          <span>Nome do grupo</span>
          <input name="groupName" value="Eleven" placeholder="vazio = grupo sem nome" />
        </label>

        <div class="imgchest-import-box span-2">
          <div>
            <p class="kicker">ImgChest scraper</p>
            <h3>Importar páginas do álbum</h3>
            <p class="hint">Cole a URL do álbum. No GitHub Pages não dá para rodar Python/Playwright; o app tenta usar a API do ImgChest. Se o navegador bloquear a página pública, informe um ImgChest API token.</p>
          </div>
          <label class="field">
            <span>URL do álbum ImgChest</span>
            <input name="albumUrl" placeholder="https://imgchest.com/p/..." />
          </label>
          <label class="field">
            <span>ImgChest API token opcional</span>
            <input name="imgchestToken" value="${attr(savedToken)}" type="password" placeholder="opcional" />
          </label>
          <div class="row-actions">
            <button class="btn ghost" type="button" id="modal-import-imgchest-btn">Importar ImgChest</button>
            <button class="btn ghost" type="button" id="modal-extract-imgchest-btn">Extrair URLs coladas</button>
          </div>
        </div>

        <label class="field span-2">
          <span>URLs das imagens</span>
          <textarea name="linksText" rows="10" placeholder="As URLs importadas do ImgChest vão aparecer aqui. Você também pode colar uma URL por linha manualmente."></textarea>
        </label>

        <div class="modal-actions span-2">
          <button class="btn primary" type="submit">Criar capítulo</button>
          <button class="btn ghost" type="button" data-close-modal>Cancelar</button>
        </div>
      </form>
    </section>
  `;
  document.body.appendChild(modal);

  const form = modal.querySelector("#add-chapter-modal-form");
  const close = () => modal.remove();
  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));

  modal.querySelector("#modal-import-imgchest-btn").addEventListener("click", async () => {
    const albumUrl = form.albumUrl.value.trim();
    const token = form.imgchestToken.value.trim();
    if (!albumUrl) {
      toast("Cole a URL do álbum ImgChest primeiro.", "error");
      return;
    }
    try {
      setBusy(true);
      const btn = modal.querySelector("#modal-import-imgchest-btn");
      btn.textContent = "Importando...";
      const links = await scrapeImgChestAlbum(albumUrl, { token });
      form.linksText.value = links.join("\n");
      if (token) state.config.imgchestToken = token;
      toast(`${links.length} imagens importadas do ImgChest.`, "success");
    } catch (error) {
      toast(error.message || String(error), "error");
    } finally {
      const btn = modal.querySelector("#modal-import-imgchest-btn");
      if (btn) btn.textContent = "Importar ImgChest";
      setBusy(false);
    }
  });

  modal.querySelector("#modal-extract-imgchest-btn").addEventListener("click", () => {
    const links = extractImgChestLinksFromText(form.linksText.value || "");
    if (!links.length) {
      toast("Não encontrei URLs cdn.imgchest.com no texto colado.", "error");
      return;
    }
    form.linksText.value = links.join("\n");
    toast(`${links.length} URLs ImgChest extraídas.`, "success");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = document.querySelector("#chapters-list");
    document.querySelector("#no-chapters-state")?.remove();

    const formData = new FormData(form);
    const number = String(formData.get("number") || "").trim();
    if (!number) {
      toast("Informe o número do capítulo.", "error");
      return;
    }

    const links = String(formData.get("linksText") || "")
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
    const groupName = String(formData.get("groupName") || "").trim();
    const chapter = {
      title: String(formData.get("title") || "").trim(),
      volume: String(formData.get("volume") || ""),
      last_updated: String(Math.floor(Date.now() / 1000)),
      groups: {
        [groupName]: links,
      },
    };

    list.insertAdjacentHTML("beforeend", renderChapterCard(number, chapter));
    const card = list.lastElementChild;
    bindChapterButtons(card);
    close();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    updateEditorStats();
  });

  form.number?.focus();
}

function collectManifestFromEditor(options = {}) {
  const form = document.querySelector("#editor-form");
  const formData = new FormData(form);
  const manifest = normalizeManifest({
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || ""),
    artist: String(formData.get("artist") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    cover: String(formData.get("cover") || "").trim(),
    chapters: {},
  });

  const chapterCards = [...document.querySelectorAll("[data-chapter-card]")];
  const duplicateNumbers = new Set();
  const seen = new Set();

  for (const card of chapterCards) {
    const number = card.querySelector("[data-chapter-number]")?.value.trim();
    if (!number) continue;
    if (seen.has(number)) duplicateNumbers.add(number);
    seen.add(number);

    const chapter = {
      title: card.querySelector("[data-chapter-title]")?.value || "",
      volume: card.querySelector("[data-chapter-volume]")?.value || "",
      last_updated: card.querySelector("[data-chapter-updated]")?.value || String(Math.floor(Date.now() / 1000)),
      groups: {},
    };

    const groupCards = [...card.querySelectorAll("[data-group-card]")];
    for (const groupCard of groupCards) {
      const groupName = groupCard.querySelector("[data-group-name]")?.value.trim() || "";
      const imagesText = groupCard.querySelector("[data-group-images]")?.value || "";
      const images = imagesText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      chapter.groups[groupName] = images;
    }

    if (!Object.keys(chapter.groups).length) chapter.groups[""] = [];
    manifest.chapters[number] = chapter;
  }

  const fileName = String(formData.get("fileName") || "").trim() || sanitizeFileName(manifest.title);
  const errors = [];
  if (duplicateNumbers.size) {
    errors.push(`Há capítulos duplicados: ${[...duplicateNumbers].join(", ")}.`);
  }

  const validation = validateManifest(manifest, fileName);
  validation.errors.unshift(...errors);

  if (!options.silent && validation.errors.length) {
    toast(validation.errors[0], "error");
  }

  return {
    manifest,
    fileName,
    validation,
  };
}

function updateEditorStats() {
  const { manifest } = collectManifestFromEditor({ silent: true });
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

async function saveCurrentEditor() {
   const { manifest, fileName, validation } = collectManifestFromEditor();
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
     const result = await client.putFile({
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
       sha: result.content?.sha,
       data: manifest,
     };

     const existingIndex = state.files.findIndex((file) => file.path === desiredPath || file.path === oldPath);
     const record = {
       name: fileName,
       path: desiredPath,
       sha: result.content?.sha,
       htmlUrl: result.content?.html_url,
       downloadUrl: result.content?.download_url,
       data: manifest,
     };
     if (existingIndex >= 0) state.files[existingIndex] = record;
     else state.files.push(record);

     toast("JSON salvo no GitHub.", "success");
     renderEditor();
   } catch (error) {
     toast(errorMessage(error), "error");
   } finally {
     setBusy(false);
   }
 }

async function deleteCurrentFile() {
   if (!state.current || state.current.isNew) {
     toast("Não é possível deletar um arquivo que ainda não foi salvo.", "error");
     return;
   }

   if (!confirm("Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.")) {
     return;
   }

   try {
     setBusy(true);
     const client = ensureClient();
     await client.deleteFile({
       ...state.config,
       path: state.current.path,
       message: `Delete ${state.current.name} via Adder Pages`,
       sha: state.current.sha,
     });

     // Remove from files list
     state.files = state.files.filter(file => file.path !== state.current.path);
     
     toast("Obra excluída com sucesso.", "success");
     renderDashboard();
   } catch (error) {
     console.error("Erro ao deletar arquivo:", error);
     toast(errorMessage(error), "error");
   } finally {
     setBusy(false);
   }
 }

function showJsonModal(manifest) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal-card">
      <div class="panel-header">
        <div>
          <p class="kicker">Preview</p>
          <h2>JSON gerado</h2>
        </div>
        <button class="btn ghost" data-close-modal>Fechar</button>
      </div>
      <pre><code>${escapeHtml(prettyJson(manifest))}</code></pre>
      <div class="modal-actions">
        <button class="btn primary" data-copy-json>Copiar JSON</button>
      </div>
    </section>
  `;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });
  modal.querySelector("[data-copy-json]").addEventListener("click", () => copyText(prettyJson(manifest)));
}

function showValidationModal(validation) {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  const errors = validation.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const warnings = validation.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  modal.innerHTML = `
    <section class="modal-card">
      <div class="panel-header">
        <div>
          <p class="kicker">Validação</p>
          <h2>Corrija antes de salvar</h2>
        </div>
        <button class="btn ghost" data-close-modal>Fechar</button>
      </div>
      ${errors ? `<div class="error-box"><strong>Erros</strong><ul>${errors}</ul></div>` : ""}
      ${warnings ? `<div class="notice" style="margin-top: 12px;"><strong>Avisos</strong><ul>${warnings}</ul></div>` : ""}
    </section>
  `;
  document.body.appendChild(modal);
  modal.querySelector("[data-close-modal]").addEventListener("click", () => modal.remove());
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiado.", "success");
  } catch {
    toast("Não consegui copiar automaticamente.", "error");
  }
}

renderLanding();
