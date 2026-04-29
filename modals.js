import { escapeHtml, attr } from "./utils.js";
import { prettyJson, countImages, countGroups } from "./cubari.js";
import { collectManifestFromEditor, getNextChapterNumber } from "./editor-collector.js";
import { copyText } from "./clipboard.js";
import { toast, setBusy } from "./ui.js";
import { state, getSavedImgChestToken } from "./state.js";

import { scrapeImgChestAlbum as scrapeImgChest, extractImgChestLinksFromText as extractLinks } from "./imgchest.js";

function renderValidationList(title, items = [], className = "notice") {
  if (!items.length) return "";
  return `<div class="${className}" style="margin-top: 12px;"><strong>${escapeHtml(title)}</strong><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

export function showJsonModal(manifest, validation = { errors: [], warnings: [] }) {
  const chapters = Object.keys(manifest.chapters || {}).length;
  const groups = countGroups(manifest);
  const images = countImages(manifest);
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal-card">
      <div class="panel-header">
        <div>
          <p class="kicker">Preview</p>
          <h2>JSON gerado</h2>
          <p>${chapters} capítulos · ${groups} grupos · ${images} imagens</p>
        </div>
        <button class="btn ghost" data-close-modal>Fechar</button>
      </div>
      ${renderValidationList("Erros", validation.errors || [], "error-box")}
      ${renderValidationList("Avisos", validation.warnings || [], "notice")}
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

export function showValidationModal(validation) {
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

export function showAddChapterModal(renderChapterCard, bindChapterButtons, updateEditorStats) {
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
          <input name="volume" placeholder="opcional" />
        </label>

        <label class="field">
          <span>Nome do grupo</span>
          <input name="groupName" placeholder="vazio = grupo sem nome" />
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
      const links = await scrapeImgChest(albumUrl, { token });
      form.linksText.value = links.join("\n");
      if (token && state.config) state.config.imgchestToken = token;
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
    const links = extractLinks(form.linksText.value || "");
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
