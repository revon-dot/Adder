import { state, getSavedImgChestToken } from "../state.js";
import { attr, escapeHtml } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbum, extractImgChestLinksFromText } from "../imgchest.js";
import { emptyChapter } from "../cubari.js";

function groupToText(images = []) {
  return Array.isArray(images) ? images.join("\n") : String(images || "");
}

function renderGroupEditor(groupName = "", images = []) {
  return `
    <section class="group-card drawer-group" data-modal-group>
      <div class="group-header">
        <label class="field" style="flex: 1;">
          <span>Nome do grupo</span>
          <input data-modal-group-name value="${attr(groupName)}" placeholder="vazio = grupo sem nome" />
        </label>
        <button class="btn danger small subtle-danger" type="button" data-modal-remove-group>Remover</button>
      </div>
      <div class="imgchest-tools compact-imgchest-tools">
        <label class="field imgchest-url-field">
          <span>ImgChest album URL</span>
          <input data-modal-imgchest-url placeholder="https://imgchest.com/p/..." />
        </label>
        <div class="inline-tools">
          <button class="btn ghost small" type="button" data-modal-import-imgchest>Importar</button>
          <button class="btn ghost small" type="button" data-modal-extract-imgchest>Extrair</button>
        </div>
      </div>
      <label class="field">
        <span>URLs das imagens</span>
        <textarea class="urls-textarea" data-modal-group-images placeholder="Cole uma URL por linha">${escapeHtml(groupToText(images))}</textarea>
      </label>
    </section>
  `;
}

function collectChapterFromModal(form) {
  const formData = new FormData(form);
  const number = String(formData.get("number") || "").trim();
  const chapter = {
    title: String(formData.get("title") || "").trim(),
    volume: String(formData.get("volume") || ""),
    last_updated: String(formData.get("last_updated") || Math.floor(Date.now() / 1000)).trim(),
    groups: {},
  };
  const duplicateGroups = new Set();
  const seenGroups = new Set();

  form.querySelectorAll("[data-modal-group]").forEach((group) => {
    const groupName = group.querySelector("[data-modal-group-name]")?.value.trim() || "";
    if (seenGroups.has(groupName)) duplicateGroups.add(groupName || "sem nome");
    seenGroups.add(groupName);

    const imagesText = group.querySelector("[data-modal-group-images]")?.value || "";
    chapter.groups[groupName] = imagesText
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
  });

  if (!Object.keys(chapter.groups).length) chapter.groups[""] = [];
  return { number, chapter, duplicateGroups: [...duplicateGroups] };
}

export function showChapterEditModal({ number = "", chapter = emptyChapter(), onSave, mode = "edit" }) {
  const safeChapter = { ...emptyChapter(), ...(chapter || {}) };
  const groupEntries = Object.entries(safeChapter.groups || { "": [] });
  const isNew = mode === "create";
  const modal = document.createElement("div");
  modal.className = "drawer-backdrop";
  modal.innerHTML = `
    <aside class="chapter-drawer">
      <div class="drawer-header">
        <div>
          <p class="kicker">Capítulo</p>
          <h2>${isNew ? "Novo capítulo" : `Editar ${escapeHtml(number)}`}</h2>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>Fechar</button>
      </div>

      <form id="chapter-edit-form" class="drawer-form" autocomplete="off">
        <div class="drawer-grid">
          <label class="field">
            <span>Número</span>
            <input name="number" value="${attr(number)}" placeholder="1" required />
          </label>
          <label class="field">
            <span>Volume</span>
            <input name="volume" value="${attr(safeChapter.volume)}" placeholder="opcional" />
          </label>
        </div>
        <label class="field">
          <span>Título do capítulo</span>
          <input name="title" value="${attr(safeChapter.title)}" placeholder="Capítulo 1" />
        </label>
        <label class="field">
          <span>Last updated</span>
          <input name="last_updated" value="${attr(safeChapter.last_updated || Math.floor(Date.now() / 1000))}" placeholder="timestamp" />
        </label>

        <div class="drawer-section-title">
          <strong>Grupos e imagens</strong>
          <button class="btn ghost small" type="button" id="modal-add-group-btn">Adicionar grupo</button>
        </div>
        <div id="modal-groups-list">
          ${groupEntries.map(([groupName, images]) => renderGroupEditor(groupName, images)).join("")}
        </div>

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${isNew ? "Criar capítulo" : "Salvar capítulo"}</button>
          <button class="btn ghost" type="button" data-close-modal>Cancelar</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#chapter-edit-form");
  const groupsList = modal.querySelector("#modal-groups-list");
  const close = () => modal.remove();

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  modal.querySelector("#modal-add-group-btn")?.addEventListener("click", () => {
    groupsList.insertAdjacentHTML("beforeend", renderGroupEditor("", []));
  });

  modal.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-modal-remove-group]")) {
      const groups = modal.querySelectorAll("[data-modal-group]");
      if (groups.length <= 1) {
        toast("O capítulo precisa ter pelo menos um grupo.", "error");
        return;
      }
      target.closest("[data-modal-group]")?.remove();
      return;
    }

    if (target.matches("[data-modal-extract-imgchest]")) {
      const group = target.closest("[data-modal-group]");
      const textarea = group?.querySelector("[data-modal-group-images]");
      const links = extractImgChestLinksFromText(textarea?.value || "");
      if (!links.length) {
        toast("Não encontrei URLs cdn.imgchest.com no texto colado.", "error");
        return;
      }
      textarea.value = links.join("\n");
      toast(`${links.length} URLs ImgChest extraídas.`, "success");
      return;
    }

    if (target.matches("[data-modal-import-imgchest]")) {
      const group = target.closest("[data-modal-group]");
      const input = group?.querySelector("[data-modal-imgchest-url]");
      const textarea = group?.querySelector("[data-modal-group-images]");
      const albumUrl = input?.value.trim();
      if (!albumUrl) {
        toast("Cole a URL do álbum ImgChest primeiro.", "error");
        return;
      }
      const token = state.config?.imgchestToken || getSavedImgChestToken();
      try {
        setBusy(true);
        target.textContent = "Importando...";
        const links = await scrapeImgChestAlbum(albumUrl, { token });
        textarea.value = links.join("\n");
        toast(`${links.length} imagens importadas do ImgChest.`, "success");
      } catch (error) {
        toast(error.message || String(error), "error");
      } finally {
        target.textContent = "Importar";
        setBusy(false);
      }
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = collectChapterFromModal(form);
    if (!result.number) {
      toast("Informe o número do capítulo.", "error");
      return;
    }
    if (result.duplicateGroups.length) {
      toast(`Há grupos duplicados: ${result.duplicateGroups.join(", ")}. Use nomes diferentes antes de salvar.`, "error");
      return;
    }
    onSave(result);
    close();
  });

  form.number?.focus();
}
