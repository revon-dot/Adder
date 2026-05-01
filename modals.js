import { escapeHtml, attr } from "./utils.js";
import { prettyJson, countImages, countGroups } from "./cubari.js";
import { collectManifestFromEditor, getNextChapterNumber } from "./editor-collector.js";
import { copyText } from "./clipboard.js";
import { toast, setBusy } from "./ui.js";
import { state, getSavedImgChestToken } from "./state.js";
import { t } from "./i18n.js";

import { scrapeImgChestAlbum as scrapeImgChest, extractImgChestLinksFromText as extractLinks } from "./imgchest.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
          <h2>${label("JSON gerado", "Generated JSON")}</h2>
          <p>${label(`${chapters} capítulos · ${groups} grupos · ${images} imagens`, `${chapters} chapters · ${groups} groups · ${images} images`)}</p>
        </div>
        <button class="btn ghost" data-close-modal>${t("close")}</button>
      </div>
      ${renderValidationList(label("Erros", "Errors"), validation.errors || [], "error-box")}
      ${renderValidationList(label("Avisos", "Warnings"), validation.warnings || [], "notice")}
      <pre><code>${escapeHtml(prettyJson(manifest))}</code></pre>
      <div class="modal-actions">
        <button class="btn primary" data-copy-json>${label("Copiar JSON", "Copy JSON")}</button>
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
          <p class="kicker">${label("Validação", "Validation")}</p>
          <h2>${label("Corrija antes de salvar", "Fix these before saving")}</h2>
        </div>
        <button class="btn ghost" data-close-modal>${t("close")}</button>
      </div>
      ${errors ? `<div class="error-box"><strong>${label("Erros", "Errors")}</strong><ul>${errors}</ul></div>` : ""}
      ${warnings ? `<div class="notice" style="margin-top: 12px;"><strong>${label("Avisos", "Warnings")}</strong><ul>${warnings}</ul></div>` : ""}
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
          <p class="kicker">${t("newChapter")}</p>
          <h2>${label("Adicionar capítulo com ImgChest", "Add chapter with ImgChest")}</h2>
          <p>${label("Funciona como o Adder local: informe número, título, volume, grupo e, se quiser, a URL do álbum ImgChest para importar as páginas.", "Works like local Adder: enter number, title, volume, group, and optionally the ImgChest album URL to import pages.")}</p>
        </div>
        <button class="btn ghost" type="button" data-close-modal>${t("close")}</button>
      </div>

      <form id="add-chapter-modal-form" class="form-grid" autocomplete="off">
        <label class="field">
          <span>${t("number")}</span>
          <input name="number" value="${attr(next)}" placeholder="1" required />
        </label>
        <label class="field">
          <span>${t("chapterTitle")}</span>
          <input name="title" placeholder="${attr(t("chapterTitlePlaceholder"))}" />
        </label>
        <label class="field">
          <span>${t("volume")}</span>
          <input name="volume" placeholder="${attr(t("volumePlaceholder"))}" />
        </label>

        <label class="field">
          <span>${t("group")}</span>
          <input name="groupName" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
        </label>

        <div class="imgchest-import-box span-2">
          <div>
            <p class="kicker">ImgChest scraper</p>
            <h3>${label("Importar páginas do álbum", "Import album pages")}</h3>
            <p class="hint">${label("Cole a URL do álbum. No GitHub Pages não dá para rodar Python/Playwright; o app tenta usar a API do ImgChest. Se o navegador bloquear a página pública, informe um ImgChest API token.", "Paste the album URL. GitHub Pages cannot run Python/Playwright, so the app tries to use the ImgChest API. If the browser blocks the public page, enter an ImgChest API token.")}</p>
          </div>
          <label class="field">
            <span>${t("imgChestAlbumUrl")}</span>
            <input name="albumUrl" placeholder="${attr(t("imgChestAlbumPlaceholder"))}" />
          </label>
          <label class="field">
            <span>${label("ImgChest API token opcional", "Optional ImgChest API token")}</span>
            <input name="imgchestToken" value="${attr(savedToken)}" type="password" placeholder="${attr(t("optional"))}" />
          </label>
          <div class="row-actions">
            <button class="btn ghost" type="button" id="modal-import-imgchest-btn">${t("importImgChest")}</button>
            <button class="btn ghost" type="button" id="modal-extract-imgchest-btn">${label("Extrair URLs coladas", "Extract pasted URLs")}</button>
          </div>
        </div>

        <label class="field span-2">
          <span>${t("imageUrls")}</span>
          <textarea name="linksText" rows="10" placeholder="${attr(label("As URLs importadas do ImgChest vão aparecer aqui. Você também pode colar uma URL por linha manualmente.", "Imported ImgChest URLs will appear here. You can also paste one URL per line manually."))}"></textarea>
        </label>

        <div class="modal-actions span-2">
          <button class="btn primary" type="submit">${t("createChapter")}</button>
          <button class="btn ghost" type="button" data-close-modal>${t("cancel")}</button>
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
      toast(t("pasteImgChestFirst"), "error");
      return;
    }
    try {
      setBusy(true);
      const btn = modal.querySelector("#modal-import-imgchest-btn");
      btn.textContent = t("importing");
      const links = await scrapeImgChest(albumUrl, { token });
      form.linksText.value = links.join("\n");
      if (token && state.config) state.config.imgchestToken = token;
      toast(t("importedImages", { count: links.length }), "success");
    } catch (error) {
      toast(error.message || String(error), "error");
    } finally {
      const btn = modal.querySelector("#modal-import-imgchest-btn");
      if (btn) btn.textContent = t("importImgChest");
      setBusy(false);
    }
  });

  modal.querySelector("#modal-extract-imgchest-btn").addEventListener("click", () => {
    const links = extractLinks(form.linksText.value || "");
    if (!links.length) {
      toast(label("Não encontrei URLs cdn.imgchest.com no texto colado.", "I couldn't find cdn.imgchest.com URLs in the pasted text."), "error");
      return;
    }
    form.linksText.value = links.join("\n");
    toast(label(`${links.length} URLs ImgChest extraídas.`, `${links.length} ImgChest URLs extracted.`), "success");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const list = document.querySelector("#chapters-list");
    document.querySelector("#no-chapters-state")?.remove();

    const formData = new FormData(form);
    const number = String(formData.get("number") || "").trim();
    if (!number) {
      toast(t("informChapterNumber"), "error");
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
