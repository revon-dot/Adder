import { state, getSavedImgChestToken, IMG_TOKEN_KEY } from "../state.js";
import { attr, escapeHtml } from "../utils.js";
import { toast, setBusy, errorMessage } from "../ui.js";
import { scrapeImgChestAlbumDetails } from "../imgchest.js";
import { emptyChapter } from "../cubari.js";
import { extractChapterNumberFromTitle, normalizeChapterNumber } from "../chapter-number.js";
import { t } from "../i18n.js";
import { formatBytes } from "../image-processing.js";
import { filterSupportedLocalImages, SUPPORTED_LOCAL_IMAGE_ACCEPT } from "../batch-chapter-files.js";
import { imgChestUploadDefaults, uploadChapterToImgChest } from "../imgchest-api.js";

const SINGLE_UPLOAD_PREFS_KEY = "adder-pages:single-imgchest-upload-preferences";

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

function loadSingleUploadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(SINGLE_UPLOAD_PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveSingleUploadPreferences(form) {
  try {
    localStorage.setItem(SINGLE_UPLOAD_PREFS_KEY, JSON.stringify({
      privacy: String(form.privacy?.value || imgChestUploadDefaults.privacy),
      batchSize: String(form.batchSize?.value || imgChestUploadDefaults.batchSize),
      delayMs: String(form.delayMs?.value || imgChestUploadDefaults.delayMs),
      titleTemplate: String(form.postTitleTemplate?.value || "{title} {chapter}"),
    }));
  } catch {
    // Ignore storage errors.
  }
}

function collectManualChapterFromModal(form) {
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

function collectBaseChapterFields(form) {
  const formData = new FormData(form);
  return {
    number: normalizeChapterNumber(formData.get("number") || ""),
    title: String(formData.get("title") || "").trim(),
    volume: String(formData.get("volume") || ""),
    groupName: String(formData.get("groupName") || "").trim(),
    lastUpdated: String(formData.get("last_updated") || Math.floor(Date.now() / 1000)).trim(),
  };
}

function getSelectedImages(form) {
  return filterSupportedLocalImages(form.querySelector("input[name='chapterImages']")?.files || []);
}

function selectedImagesSummary(files = []) {
  if (!files.length) return label("Nenhuma imagem selecionada ainda.", "No images selected yet.");
  const first = files.slice(0, 8).map((file) => file.name).join(" → ");
  const remaining = files.length > 8 ? ` +${files.length - 8}` : "";
  const totalBytes = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
  return label(`${files.length} imagem(ns) · ${formatBytes(totalBytes)}\n${first}${remaining}`, `${files.length} image(s) · ${formatBytes(totalBytes)}\n${first}${remaining}`);
}

function updateFilePreview(form) {
  const preview = form.querySelector("[data-single-upload-selection]");
  if (!preview) return;
  preview.textContent = selectedImagesSummary(getSelectedImages(form));
}

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function addConsoleLine(modal, level, text) {
  const consoleEl = modal.querySelector("[data-single-upload-console]");
  if (!consoleEl) return;
  const line = document.createElement("div");
  line.className = `upload-console-line ${level}`;
  line.innerHTML = `<span class="time">[${timestamp()}]</span> <span class="level">${String(level || "info").toUpperCase()}</span> <span class="message"></span>`;
  line.querySelector(".message").textContent = text;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setSingleProgress(modal, text, progress = 0) {
  const progressSection = modal.querySelector("[data-single-upload-progress]");
  const status = modal.querySelector("[data-single-upload-status]");
  const bar = modal.querySelector("[data-single-upload-bar]");
  if (progressSection) progressSection.hidden = false;
  if (status) status.textContent = text;
  if (bar) bar.style.setProperty("--progress", `${Math.max(0, Math.min(100, progress))}%`);
}

function disableForm(form, disabled) {
  form.querySelectorAll("input, textarea, select, button").forEach((element) => {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLButtonElement
    ) {
      element.disabled = disabled;
    }
  });
}

function buildSinglePostTitle(template, { mangaTitle, chapterNumber, chapterTitle }) {
  return String(template || "{title} {chapter}")
    .replaceAll("{title}", mangaTitle || "Manga")
    .replaceAll("{manga}", mangaTitle || "Manga")
    .replaceAll("{chapter}", chapterNumber)
    .replaceAll("{chapterTitle}", chapterTitle || "")
    .trim();
}

function applyDetectedAlbumMetadata({ form, details }) {
  const numberInput = form.querySelector("[name='number']");
  const titleInput = form.querySelector("[name='title']");
  const detectedNumber = extractChapterNumberFromTitle(details.title);

  if (detectedNumber && numberInput) {
    numberInput.value = normalizeChapterNumber(detectedNumber);
  }

  if (details.title && titleInput && !titleInput.value.trim()) {
    titleInput.value = details.title;
  }

  return detectedNumber ? normalizeChapterNumber(detectedNumber) : "";
}

async function importExistingImgChestAlbum({ modal, form, onSave, close, isNew }) {
  const input = modal.querySelector("[data-existing-imgchest-url]");
  const albumUrl = input?.value.trim();

  if (!albumUrl) {
    toast(t("pasteImgChestFirst"), "error");
    return;
  }

  const trigger = modal.querySelector("[data-import-existing-imgchest]");
  const originalText = trigger?.textContent || "";
  const token = state.config?.imgchestToken || getSavedImgChestToken();

  try {
    disableForm(form, true);
    setBusy(true);
    if (trigger) trigger.textContent = t("importing");

    const details = await scrapeImgChestAlbumDetails(albumUrl, { token });
    const detectedNumber = applyDetectedAlbumMetadata({ form, details });
    const textarea = form.querySelector("[name='imagesText']");

    if (textarea) {
      textarea.value = details.images.join("\n");
      const suffix = detectedNumber
        ? label(` Capítulo detectado: ${detectedNumber}.`, ` Detected chapter: ${detectedNumber}.`)
        : "";
      toast(`${t("importedImages", { count: details.images.length })}${suffix}`, "success");
      return;
    }

    if (!isNew) return;

    const fields = collectBaseChapterFields(form);
    if (!fields.number) {
      toast(t("informChapterNumber"), "error");
      return;
    }

    onSave({
      number: fields.number,
      chapter: {
        title: fields.title,
        volume: fields.volume,
        last_updated: fields.lastUpdated,
        groups: {
          [fields.groupName]: details.images,
        },
      },
    });

    toast(t("importedImages", { count: details.images.length }), "success");
    close();
  } catch (error) {
    toast(errorMessage(error), "error");
  } finally {
    if (trigger) trigger.textContent = originalText;
    disableForm(form, false);
    setBusy(false);
  }
}

async function uploadSingleChapterFromModal({ modal, form, onSave, close }) {
  const fields = collectBaseChapterFields(form);
  if (!fields.number) {
    toast(t("informChapterNumber"), "error");
    return;
  }

  const files = getSelectedImages(form);
  if (!files.length) {
    toast(label("Selecione as imagens do capítulo.", "Select the chapter images."), "error");
    return;
  }

  const formData = new FormData(form);
  const token = String(formData.get("imgchestToken") || "").trim();
  if (!token) {
    toast(label("Informe o token do ImgChest.", "Enter the ImgChest token."), "error");
    return;
  }

  const rememberToken = Boolean(formData.get("rememberToken"));
  const privacy = String(formData.get("privacy") || imgChestUploadDefaults.privacy);
  const batchSize = Math.min(20, Math.max(1, Number.parseInt(formData.get("batchSize"), 10) || imgChestUploadDefaults.batchSize));
  const delayMs = Math.max(0, Number.parseInt(formData.get("delayMs"), 10) || imgChestUploadDefaults.delayMs);
  const titleTemplate = String(formData.get("postTitleTemplate") || "{title} {chapter}").trim() || "{title} {chapter}";
  const mangaTitle = state.current?.data?.title || state.current?.name?.replace(/\.json$/i, "") || "Manga";
  const postTitle = buildSinglePostTitle(titleTemplate, {
    mangaTitle,
    chapterNumber: fields.number,
    chapterTitle: fields.title,
  });

  saveSingleUploadPreferences(form);
  try {
    if (rememberToken) localStorage.setItem(IMG_TOKEN_KEY, token);
    else localStorage.removeItem(IMG_TOKEN_KEY);
  } catch {
    // Ignore storage errors.
  }

  try {
    disableForm(form, true);
    setBusy(true);
    setSingleProgress(modal, label("Preparando upload...", "Preparing upload..."), 0);
    addConsoleLine(modal, "info", label(`Capítulo ${fields.number}: ${files.length} imagem(ns) selecionada(s).`, `Chapter ${fields.number}: ${files.length} image(s) selected.`));
    addConsoleLine(modal, "info", label(`Criando post no ImgChest: ${postTitle}`, `Creating ImgChest post: ${postTitle}`));

    const result = await uploadChapterToImgChest({
      token,
      albumName: mangaTitle,
      chapterGroup: {
        number: fields.number,
        folder: fields.number,
        folderPath: fields.number,
        files,
      },
      titleTemplate: postTitle,
      privacy,
      batchSize,
      retry: {
        delayMs,
        rateLimitWaitMs: imgChestUploadDefaults.rateLimitWaitMs,
        maxRetries: imgChestUploadDefaults.maxRetries,
        onRateLimit: ({ waitMs, attempt, maxRetries }) => {
          const message = label(`Limite da API atingido. Esperando ${Math.ceil(waitMs / 1000)}s (${attempt}/${maxRetries}).`, `API rate limit reached. Waiting ${Math.ceil(waitMs / 1000)}s (${attempt}/${maxRetries}).`);
          addConsoleLine(modal, "warn", message);
          setSingleProgress(modal, message, 45);
        },
      },
      onStatus: ({ phase, batchIndex, batchTotal }) => {
        if (phase === "create") {
          const message = label(`Criando post com ${files.length} imagem(ns).`, `Creating post with ${files.length} image(s).`);
          addConsoleLine(modal, "info", message);
          setSingleProgress(modal, message, 20);
        }
        if (phase === "add") {
          const progress = Math.round(((batchIndex + 1) / batchTotal) * 80);
          const message = label(`Adicionando batch ${batchIndex + 1}/${batchTotal}.`, `Adding batch ${batchIndex + 1}/${batchTotal}.`);
          addConsoleLine(modal, "info", message);
          setSingleProgress(modal, message, progress);
        }
        if (phase === "refresh") {
          const message = label("Buscando links finais das imagens.", "Fetching final image links.");
          addConsoleLine(modal, "info", message);
          setSingleProgress(modal, message, 90);
        }
      },
    });

    setSingleProgress(modal, label("Upload concluído. Montando capítulo...", "Upload complete. Building chapter..."), 100);
    addConsoleLine(modal, "success", label(`Upload concluído com ${result.imageUrls.length} imagem(ns): ${result.postUrl}`, `Upload complete with ${result.imageUrls.length} image(s): ${result.postUrl}`));

    onSave({
      number: fields.number,
      chapter: {
        title: fields.title,
        volume: fields.volume,
        last_updated: fields.lastUpdated,
        groups: {
          [fields.groupName]: result.imageUrls,
        },
      },
    });
    close();
  } catch (error) {
    addConsoleLine(modal, "error", errorMessage(error));
    toast(errorMessage(error), "error");
  } finally {
    disableForm(form, false);
    setBusy(false);
  }
}

function renderExistingAlbumImportSection({ isNew }) {
  return `
    <div class="drawer-section-title">
      <strong>${label("Importar álbum existente", "Import existing album")}</strong>
    </div>

    <div class="imgchest-tools compact-imgchest-tools chapter-images-tools">
      <label class="field imgchest-url-field">
        <span>${label("URL do Álbum ImgChest", "ImgChest Album URL")}</span>
        <input data-existing-imgchest-url placeholder="${attr(t("imgChestAlbumPlaceholder"))}" />
        <p class="hint">${label(
          isNew
            ? "Use quando o capítulo já foi enviado ao ImgChest. O Adder só importa os links para o JSON."
            : "Use para substituir/preencher a lista de URLs abaixo usando um álbum já existente.",
          isNew
            ? "Use this when the chapter is already on ImgChest. Adder only imports the links into the JSON."
            : "Use this to replace/fill the URL list below from an existing album.",
        )}</p>
      </label>
      <div class="inline-tools">
        <button class="btn ghost small" type="button" data-import-existing-imgchest>
          ${isNew ? label("Importar URL e Criar", "Import URL and Create") : t("importImgChest")}
        </button>
      </div>
    </div>
  `;
}

function renderCreateImagesSection(preferences, savedToken) {
  return `
    ${renderExistingAlbumImportSection({ isNew: true })}

    <div class="drawer-section-title">
      <strong>${label("Ou enviar imagens locais", "Or upload local images")}</strong>
    </div>

    <label class="field">
      <span>${label("Token ImgChest", "ImgChest token")}</span>
      <input name="imgchestToken" type="password" value="${attr(savedToken)}" />
      <p class="hint">${label("O token é usado direto no navegador porque o Adder é estático.", "The token is used directly in the browser because Adder is static.")}</p>
    </label>

    <label class="checkbox-line">
      <input name="rememberToken" type="checkbox" ${savedToken ? "checked" : ""} />
      <span>${label("Salvar token neste navegador", "Save token in this browser")}</span>
    </label>

    <label class="field">
      <span>${label("Selecionar imagens", "Select images")}</span>
      <input name="chapterImages" type="file" accept="${SUPPORTED_LOCAL_IMAGE_ACCEPT}" multiple />
      <p class="hint">${label("Selecione as páginas do capítulo. A ordem será natural: 1, 2, 10...", "Select the chapter pages. Order will be natural: 1, 2, 10...")}</p>
    </label>

    <div class="notice">
      <strong data-single-upload-selection>${label("Nenhuma imagem selecionada ainda.", "No images selected yet.")}</strong>
    </div>

    <div class="drawer-grid chapter-meta-grid">
      <label class="field">
        <span>${label("Privacidade", "Privacy")}</span>
        <select name="privacy">
          <option value="hidden" ${(preferences.privacy || imgChestUploadDefaults.privacy) === "hidden" ? "selected" : ""}>hidden</option>
          <option value="public" ${preferences.privacy === "public" ? "selected" : ""}>public</option>
          <option value="secret" ${preferences.privacy === "secret" ? "selected" : ""}>secret</option>
        </select>
      </label>
      <label class="field">
        <span>${label("Imagens por request", "Images per request")}</span>
        <input name="batchSize" type="number" min="1" max="20" step="1" value="${attr(preferences.batchSize || imgChestUploadDefaults.batchSize)}" />
      </label>
      <label class="field">
        <span>${label("Delay entre requests (ms)", "Delay between requests (ms)")}</span>
        <input name="delayMs" type="number" min="0" step="50" value="${attr(preferences.delayMs || imgChestUploadDefaults.delayMs)}" />
      </label>
      <label class="field">
        <span>${label("Título do post", "Post title")}</span>
        <input name="postTitleTemplate" value="${attr(preferences.titleTemplate || "{title} {chapter}")}" />
      </label>
    </div>
    <p class="hint">${label("Variáveis do título: {title}, {manga}, {chapter}, {chapterTitle}.", "Title variables: {title}, {manga}, {chapter}, {chapterTitle}.")}</p>

    <section class="multi-chapter-progress" data-single-upload-progress hidden>
      <div class="multi-chapter-progress-head">
        <div class="multi-chapter-spinner" aria-hidden="true"></div>
        <div>
          <h3>${label("Console de upload", "Upload console")}</h3>
          <p data-single-upload-status>${label("Preparando...", "Preparing...")}</p>
        </div>
      </div>
      <div class="multi-chapter-bar" aria-hidden="true"><span data-single-upload-bar></span></div>
      <div class="upload-console" data-single-upload-console></div>
    </section>
  `;
}

function renderEditImagesSection(images) {
  return `
    <div class="drawer-section-title">
      <strong>${t("imagesSection")}</strong>
    </div>

    ${renderExistingAlbumImportSection({ isNew: false })}

    <label class="field">
      <span>${label("URLs das Imagens", "Image URLs")}</span>
      <textarea class="urls-textarea" name="imagesText" placeholder="${attr(t("imageUrlsPlaceholder"))}">${escapeHtml(groupToText(images))}</textarea>
    </label>
  `;
}

export function showChapterEditModal({ number = "", chapter = emptyChapter(), onSave, mode = "edit" }) {
  const safeChapter = { ...emptyChapter(), ...(chapter || {}) };
  const [groupName, images] = getPrimaryGroup(safeChapter);
  const isNew = mode === "create";
  const preferences = loadSingleUploadPreferences();
  const savedToken = getSavedImgChestToken();
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

        ${isNew ? renderCreateImagesSection(preferences, savedToken) : renderEditImagesSection(images)}

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${isNew ? label("Enviar e Criar Capítulo", "Upload and Create Chapter") : label("Salvar Capítulo", "Save Chapter")}</button>
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
  form.querySelector("input[name='chapterImages']")?.addEventListener("change", () => updateFilePreview(form));
  modal.querySelector("[data-import-existing-imgchest]")?.addEventListener("click", () => {
    importExistingImgChestAlbum({ modal, form, onSave, close, isNew });
  });
  ["privacy", "batchSize", "delayMs", "postTitleTemplate"].forEach((name) => {
    form.querySelector(`[name='${name}']`)?.addEventListener("input", () => saveSingleUploadPreferences(form));
    form.querySelector(`[name='${name}']`)?.addEventListener("change", () => saveSingleUploadPreferences(form));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isNew) {
      await uploadSingleChapterFromModal({ modal, form, onSave, close });
      return;
    }

    const result = collectManualChapterFromModal(form);
    if (!result.number) {
      toast(t("informChapterNumber"), "error");
      return;
    }
    onSave(result);
    close();
  });

  form.number?.focus();
}
