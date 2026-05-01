import { state, getSavedImgChestToken } from "../state.js";
import { attr, escapeHtml } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbumDetails } from "../imgchest.js";
import { emptyChapter } from "../cubari.js";
import { extractChapterNumberFromTitle, normalizeChapterNumber } from "../chapter-number.js";
import { t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
    number: normalizeChapterNumber(formData.get("number") || ""),
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
          <p class="kicker">${t("chapter")}</p>
          <h2>${isNew ? t("newChapter") : `${t("editChapter")} ${escapeHtml(number)}`}</h2>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>${t("close")}</button>
      </div>

      <form id="chapter-edit-form" class="drawer-form" autocomplete="off">
        <div class="drawer-grid chapter-meta-grid">
          <label class="field">
            <span>${t("number")}</span>
            <input name="number" value="${attr(normalizeChapterNumber(number))}" placeholder="${attr(t("chapterNumberPlaceholder"))}" required />
          </label>
          <label class="field">
            <span>${t("volume")}</span>
            <input name="volume" value="${attr(safeChapter.volume)}" placeholder="${attr(t("volumePlaceholder"))}" />
          </label>
          <label class="field">
            <span>${t("group")}</span>
            <input name="groupName" value="${attr(groupName)}" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
          </label>
          <label class="field">
            <span>${label("Última Atualização", "Last Updated")}</span>
            <input name="last_updated" value="${attr(safeChapter.last_updated || Math.floor(Date.now() / 1000))}" placeholder="${attr(t("timestampPlaceholder"))}" />
          </label>
        </div>

        <label class="field">
          <span>${label("Título do Capítulo", "Chapter Title")}</span>
          <input name="title" value="${attr(safeChapter.title)}" placeholder="${attr(t("chapterTitlePlaceholder"))}" />
        </label>

        <div class="drawer-section-title">
          <strong>${t("imagesSection")}</strong>
        </div>

        <div class="imgchest-tools compact-imgchest-tools chapter-images-tools">
          <label class="field imgchest-url-field">
            <span>${label("URL do Álbum ImgChest", "ImgChest Album URL")}</span>
            <input data-modal-imgchest-url placeholder="${attr(t("imgChestAlbumPlaceholder"))}" />
          </label>
          <div class="inline-tools">
            <button class="btn ghost small" type="button" data-modal-import-imgchest>${t("importImgChest")}</button>
          </div>
        </div>

        <label class="field">
          <span>${label("URLs das Imagens", "Image URLs")}</span>
          <textarea class="urls-textarea" name="imagesText" placeholder="${attr(t("imageUrlsPlaceholder"))}">${escapeHtml(groupToText(images))}</textarea>
        </label>

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${isNew ? t("createChapter") : label("Salvar Capítulo", "Save Chapter")}</button>
          <button class="btn ghost" type="button" data-close-modal>${t("cancel")}</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#chapter-edit-form");
  const close = () => modal.remove();

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.number?.addEventListener("blur", () => {
    form.number.value = normalizeChapterNumber(form.number.value);
  });

  modal.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches("[data-modal-import-imgchest]")) {
      const input = modal.querySelector("[data-modal-imgchest-url]");
      const textarea = modal.querySelector("[name='imagesText']");
      const numberInput = modal.querySelector("[name='number']");
      const titleInput = modal.querySelector("[name='title']");
      const albumUrl = input?.value.trim();
      if (!albumUrl) {
        toast(t("pasteImgChestFirst"), "error");
        return;
      }
      const token = state.config?.imgchestToken || getSavedImgChestToken();
      try {
        setBusy(true);
        target.textContent = t("importing");
        const details = await scrapeImgChestAlbumDetails(albumUrl, { token });
        textarea.value = details.images.join("\n");

        const detectedNumber = extractChapterNumberFromTitle(details.title);
        if (detectedNumber && numberInput) {
          numberInput.value = detectedNumber;
        }

        if (details.title && titleInput && !titleInput.value.trim()) {
          titleInput.value = details.title;
        }

        const suffix = detectedNumber
          ? label(` Capítulo detectado: ${detectedNumber}.`, ` Detected chapter: ${detectedNumber}.`)
          : "";
        toast(`${t("importedImages", { count: details.images.length })}${suffix}`, "success");
      } catch (error) {
        toast(error.message || String(error), "error");
      } finally {
        target.textContent = t("importImgChest");
        setBusy(false);
      }
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = collectChapterFromModal(form);
    if (!result.number) {
      toast(t("informChapterNumber"), "error");
      return;
    }
    onSave(result);
    close();
  });

  form.number?.focus();
}
