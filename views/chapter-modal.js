import { state, getSavedImgChestToken } from "../state.js";
import { attr, escapeHtml } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbum } from "../imgchest.js";
import { emptyChapter } from "../cubari.js";

function groupToText(images = []) {
  return Array.isArray(images) ? images.join("\n") : String(images || "");
}

function getPrimaryGroup(chapter = {}) {
  const entries = Object.entries(chapter.groups || { "": [] });
  return entries[0] || ["", []];
}

function collectChapterFromModal(form) {
  const formData = new FormData(form);
  const groupName = String(formData.get("groupName") || "").trim();
  const imagesText = String(formData.get("imagesText") || "");
  const images = imagesText
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    number: String(formData.get("number") || "").trim(),
    chapter: {
      title: String(formData.get("title") || "").trim(),
      volume: String(formData.get("volume") || ""),
      last_updated: String(formData.get("last_updated") || Math.floor(Date.now() / 1000)).trim(),
      groups: {
        [groupName]: images,
      },
    },
  };
}

export function showChapterEditModal({ number = "", chapter = emptyChapter(), onSave, mode = "edit" }) {
  const safeChapter = { ...emptyChapter(), ...(chapter || {}) };
  const [groupName, images] = getPrimaryGroup(safeChapter);
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
        <div class="drawer-grid chapter-meta-grid">
          <label class="field">
            <span>Número</span>
            <input name="number" value="${attr(number)}" placeholder="1" required />
          </label>
          <label class="field">
            <span>Volume</span>
            <input name="volume" value="${attr(safeChapter.volume)}" placeholder="opcional" />
          </label>
          <label class="field">
            <span>Grupo</span>
            <input name="groupName" value="${attr(groupName)}" placeholder="vazio = grupo sem nome" />
          </label>
          <label class="field">
            <span>Última atualização</span>
            <input name="last_updated" value="${attr(safeChapter.last_updated || Math.floor(Date.now() / 1000))}" placeholder="timestamp" />
          </label>
        </div>

        <label class="field">
          <span>Título do capítulo</span>
          <input name="title" value="${attr(safeChapter.title)}" placeholder="Capítulo 1" />
        </label>

        <div class="drawer-section-title">
          <strong>Imagens</strong>
        </div>

        <div class="imgchest-tools compact-imgchest-tools chapter-images-tools">
          <label class="field imgchest-url-field">
            <span>URL do álbum ImgChest</span>
            <input data-modal-imgchest-url placeholder="https://imgchest.com/p/..." />
          </label>
          <div class="inline-tools">
            <button class="btn ghost small" type="button" data-modal-import-imgchest>Importar ImgChest</button>
          </div>
        </div>

        <label class="field">
          <span>URLs das imagens</span>
          <textarea class="urls-textarea" name="imagesText" placeholder="Cole uma URL por linha">${escapeHtml(groupToText(images))}</textarea>
        </label>

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${isNew ? "Criar capítulo" : "Salvar capítulo"}</button>
          <button class="btn ghost" type="button" data-close-modal>Cancelar</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#chapter-edit-form");
  const close = () => modal.remove();

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });

  modal.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-modal-import-imgchest]")) {
      const input = modal.querySelector("[data-modal-imgchest-url]");
      const textarea = modal.querySelector("[name='imagesText']");
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
        target.textContent = "Importar ImgChest";
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
    onSave(result);
    close();
  });

  form.number?.focus();
}
