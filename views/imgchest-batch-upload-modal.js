import { state, getSavedImgChestToken, IMG_TOKEN_KEY } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { t } from "../i18n.js";
import { formatBytes } from "../image-processing.js";
import { collectLocalChapterStats, SUPPORTED_LOCAL_IMAGE_ACCEPT } from "../batch-chapter-files.js";
import { imgChestUploadDefaults, uploadChapterToImgChest } from "../imgchest-api.js";

const PREFERENCES_KEY = "adder-pages:imgchest-batch-upload-preferences";
const LARGE_BATCH_CHAPTERS = 10;
const LARGE_BATCH_IMAGES = 300;
const LARGE_BATCH_BYTES = 500 * 1024 * 1024;

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

const copy = {
  button: () => label("Upload lote ImgChest", "ImgChest batch upload"),
  kicker: () => label("Upload local em lote", "Local batch upload"),
  title: () => label("Enviar pasta de capítulos para o ImgChest", "Upload chapter folder to ImgChest"),
  token: () => label("Token ImgChest", "ImgChest token"),
  tokenHint: () => label("Como o Adder é estático, o token é usado diretamente no navegador. Não use em computador compartilhado.", "Because Adder is static, the token is used directly in the browser. Do not use it on a shared computer."),
  rememberToken: () => label("Salvar token neste navegador", "Save token in this browser"),
  folderInput: () => label("Pasta da obra", "Work folder"),
  folderHint: () => label("Selecione a pasta da obra com subpastas de capítulos, como 0085/, 0086/, 0097.5/.", "Select the work folder with chapter subfolders, such as 0085/, 0086/, 0097.5/."),
  privacy: () => label("Privacidade", "Privacy"),
  hidden: () => label("hidden", "hidden"),
  public: () => label("public", "public"),
  secret: () => label("secret", "secret"),
  group: () => label("Grupo", "Group"),
  titleTemplate: () => label("Título do post ImgChest", "ImgChest post title"),
  titleTemplatePlaceholder: () => "{album} {chapter}",
  titleTemplateHint: () => label("Variáveis: {album}, {folder}, {chapter}.", "Variables: {album}, {folder}, {chapter}."),
  chapterTitleTemplate: () => label("Título automático no JSON", "Automatic JSON title"),
  chapterTitleTemplatePlaceholder: () => label("opcional, ex: Capítulo {chapter}", "optional, e.g. Chapter {chapter}"),
  batchSize: () => label("Imagens por request", "Images per request"),
  delay: () => label("Delay entre requests (ms)", "Delay between requests (ms)"),
  conflictMode: () => label("Se o capítulo já existir", "If the chapter already exists"),
  conflictCancel: () => label("Cancelar tudo", "Cancel all"),
  conflictSkip: () => label("Pular existentes", "Skip existing"),
  conflictReplace: () => label("Substituir capítulo", "Replace chapter"),
  conflictMerge: () => label("Substituir/mesclar grupo", "Replace/merge group"),
  selectionEmpty: () => label("Nenhuma pasta selecionada ainda.", "No folder selected yet."),
  selectionSummary: (chapters, images, size) => label(`${chapters} capítulos detectados · ${images} imagens · ${size}`, `${chapters} chapters detected · ${images} images · ${size}`),
  detectedPreview: (items, remaining) => label(`Detectado: ${items}${remaining > 0 ? ` +${remaining} capítulo(s)` : ""}`, `Detected: ${items}${remaining > 0 ? ` +${remaining} chapter(s)` : ""}`),
  skipNoNumber: (folder) => label(`Pasta ignorada sem número detectável: ${folder}`, `Skipped folder with no detectable number: ${folder}`),
  duplicateChapter: (number, folders) => label(`Capítulo ${number} aparece em mais de uma pasta: ${folders.join(" | ")}`, `Chapter ${number} appears in more than one folder: ${folders.join(" | ")}`),
  duplicateBlocked: () => label("Há capítulos duplicados em pastas diferentes. Renomeie/remova as duplicatas antes de enviar.", "There are duplicate chapters in different folders. Rename/remove duplicates before uploading."),
  largeBatchWarning: () => label("Lote grande. O upload pode demorar e acionar o limite da API.", "Large batch. Upload may take a while and trigger API rate limits."),
  confirmLargeBatch: (chapters, images, size) => label(`Você está prestes a enviar ${chapters} capítulo(s), ${images} imagem(ns), ${size}. Continuar?`, `You are about to upload ${chapters} chapter(s), ${images} image(s), ${size}. Continue?`),
  missingToken: () => label("Informe um token do ImgChest.", "Enter an ImgChest token."),
  noFiles: () => label("Selecione uma pasta com imagens.", "Select a folder with images."),
  noChapters: () => label("Nenhuma subpasta com número de capítulo foi detectada.", "No chapter-numbered subfolders were detected."),
  chapterExists: (number) => label(`Capítulo ${number} já existe.`, `Chapter ${number} already exists.`),
  confirmReplace: (count) => label(`${count} capítulo(s) existente(s) serão substituídos/mesclados no JSON. Continuar?`, `${count} existing chapter(s) will be replaced/merged in the JSON. Continue?`),
  preparing: () => label("Preparando lote...", "Preparing batch..."),
  creating: (current, total, number) => label(`Criando post do capítulo ${number} (${current}/${total})`, `Creating post for chapter ${number} (${current}/${total})`),
  addingBatch: (number, batch, total) => label(`Capítulo ${number}: adicionando batch ${batch}/${total}`, `Chapter ${number}: adding batch ${batch}/${total}`),
  refreshing: (number) => label(`Capítulo ${number}: buscando links finais`, `Chapter ${number}: fetching final links`),
  rateLimit: (seconds, attempt, max) => label(`Limite da API atingido. Esperando ${seconds}s antes de tentar de novo (${attempt}/${max}).`, `API rate limit reached. Waiting ${seconds}s before retrying (${attempt}/${max}).`),
  uploadedChapter: (number, count, url) => label(`Capítulo ${number}: ${count} imagens enviadas — ${url}`, `Chapter ${number}: ${count} images uploaded — ${url}`),
  skippedChapter: (number) => label(`Capítulo ${number} pulado porque já existe.`, `Chapter ${number} skipped because it already exists.`),
  failedChapter: (number, message) => label(`Capítulo ${number}: falhou — ${message}`, `Chapter ${number}: failed — ${message}`),
  nothingImported: () => label("Nenhum capítulo foi importado.", "No chapters were imported."),
  done: (count) => label(`${count} capítulos importados. Clique em Salvar no GitHub para gravar o JSON.`, `${count} chapters imported. Click Save to GitHub to write the JSON.`),
  summary: () => label("Resumo", "Summary"),
  startUpload: () => label("Enviar lote para ImgChest", "Upload batch to ImgChest"),
  close: () => t("close") || label("Fechar", "Close"),
  cancel: () => t("cancel") || label("Cancelar", "Cancel"),
  preferencesHint: () => label("O Adder lembra privacidade, batch, delay, grupo, templates e modo de conflito neste navegador.", "Adder remembers privacy, batch, delay, group, templates, and conflict mode in this browser."),
};

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function savePreferences(form) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      privacy: String(form.privacy?.value || imgChestUploadDefaults.privacy),
      batchSize: String(form.batchSize?.value || imgChestUploadDefaults.batchSize),
      delayMs: String(form.delayMs?.value || imgChestUploadDefaults.delayMs),
      conflictMode: String(form.conflictMode?.value || "skip"),
      groupName: String(form.groupName?.value || ""),
      titleTemplate: String(form.titleTemplate?.value || "{album} {chapter}"),
      chapterTitleTemplate: String(form.chapterTitleTemplate?.value || ""),
    }));
  } catch {
    // Ignore storage errors.
  }
}

function getSelectedFiles(form) {
  return Array.from(form.querySelector("input[name='folder']")?.files || []);
}

function getAlbumNameFromFiles(files = []) {
  const firstPath = String(files[0]?.webkitRelativePath || "");
  const firstSegment = firstPath.split("/").filter(Boolean)[0];
  return firstSegment || state.current?.data?.title || state.current?.name?.replace(/\.json$/i, "") || "Album";
}

function selectedStats(form) {
  const files = getSelectedFiles(form);
  return {
    files,
    albumName: getAlbumNameFromFiles(files),
    ...collectLocalChapterStats(files),
  };
}

function isLargeBatch(stats) {
  return stats.chapters.length > LARGE_BATCH_CHAPTERS || stats.imageCount > LARGE_BATCH_IMAGES || stats.size > LARGE_BATCH_BYTES;
}

function updateSelectionPreview(form) {
  const preview = form.querySelector("[data-imgchest-selection]");
  if (!preview) return;

  const stats = selectedStats(form);
  if (!stats.chapters.length) {
    preview.textContent = copy.selectionEmpty();
    preview.classList.remove("warning");
    return;
  }

  const first = stats.chapters.slice(0, 8).map((chapter) => `${chapter.number} (${chapter.files.length})`).join(" → ");
  const remaining = Math.max(0, stats.chapters.length - 8);
  const skipped = stats.skipped.slice(0, 5).map((folder) => copy.skipNoNumber(folder)).join("\n");
  const duplicates = stats.duplicates.map((item) => copy.duplicateChapter(item.number, item.folders)).join("\n");
  const warning = isLargeBatch(stats) ? `\n${copy.largeBatchWarning()}` : "";

  preview.textContent = `${copy.selectionSummary(stats.chapters.length, stats.imageCount, formatBytes(stats.size))}\n${copy.detectedPreview(first, remaining)}${skipped ? `\n${skipped}` : ""}${duplicates ? `\n${duplicates}` : ""}${warning}`;
  preview.classList.toggle("warning", isLargeBatch(stats) || Boolean(stats.duplicates.length));
}

function setProgress(modal, { done, total, text }) {
  const status = modal.querySelector("[data-imgchest-status]");
  const bar = modal.querySelector("[data-imgchest-bar]");
  const progress = total ? Math.round((done / total) * 100) : 0;
  if (status) status.textContent = text || copy.preparing();
  if (bar) bar.style.setProperty("--progress", `${progress}%`);
}

function addSummaryLine(modal, className, text) {
  const summary = modal.querySelector("[data-imgchest-summary]");
  if (!summary) return;
  const line = document.createElement("div");
  line.className = className;
  line.textContent = text;
  summary.appendChild(line);
  summary.scrollTop = summary.scrollHeight;
}

function disableForm(form, disabled) {
  form.querySelectorAll("input, select, button").forEach((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement) {
      element.disabled = disabled;
    }
  });
}

function collectSettings(form) {
  const formData = new FormData(form);
  const batchSize = Math.min(20, Math.max(1, Number.parseInt(formData.get("batchSize"), 10) || imgChestUploadDefaults.batchSize));
  const delayMs = Math.max(0, Number.parseInt(formData.get("delayMs"), 10) || imgChestUploadDefaults.delayMs);

  return {
    token: String(formData.get("token") || "").trim(),
    rememberToken: Boolean(formData.get("rememberToken")),
    privacy: String(formData.get("privacy") || imgChestUploadDefaults.privacy),
    groupName: String(formData.get("groupName") || "").trim(),
    titleTemplate: String(formData.get("titleTemplate") || "{album} {chapter}").trim() || "{album} {chapter}",
    chapterTitleTemplate: String(formData.get("chapterTitleTemplate") || "").trim(),
    conflictMode: String(formData.get("conflictMode") || "skip"),
    batchSize,
    delayMs,
  };
}

function chapterTitleFromTemplate(template, number) {
  return template ? template.replaceAll("{n}", number).replaceAll("{chapter}", number) : "";
}

function saveTokenPreference(settings) {
  try {
    if (settings.rememberToken) {
      localStorage.setItem(IMG_TOKEN_KEY, settings.token);
    } else {
      localStorage.removeItem(IMG_TOKEN_KEY);
    }
  } catch {
    // Ignore localStorage errors.
  }
}

async function runUpload({ modal, form, onSave }) {
  const settings = collectSettings(form);
  const stats = selectedStats(form);
  savePreferences(form);

  if (!settings.token) {
    toast(copy.missingToken(), "error");
    return false;
  }

  if (!stats.files.length) {
    toast(copy.noFiles(), "error");
    return false;
  }

  if (!stats.chapters.length) {
    toast(copy.noChapters(), "error");
    return false;
  }

  if (stats.duplicates.length) {
    toast(copy.duplicateBlocked(), "error");
    return false;
  }

  if (isLargeBatch(stats)) {
    const ok = confirm(copy.confirmLargeBatch(stats.chapters.length, stats.imageCount, formatBytes(stats.size)));
    if (!ok) return false;
  }

  const existing = state.current?.data?.chapters || {};
  const existingChapters = stats.chapters.filter((chapter) => Object.prototype.hasOwnProperty.call(existing, chapter.number));
  if (existingChapters.length && settings.conflictMode === "cancel") {
    toast(copy.chapterExists(existingChapters.map((chapter) => chapter.number).join(", ")), "error");
    return false;
  }
  if (existingChapters.length && ["replace", "merge"].includes(settings.conflictMode)) {
    const ok = confirm(copy.confirmReplace(existingChapters.length));
    if (!ok) return false;
  }

  const chaptersToUpload = settings.conflictMode === "skip"
    ? stats.chapters.filter((chapter) => {
      const exists = Object.prototype.hasOwnProperty.call(existing, chapter.number);
      if (exists) addSummaryLine(modal, "skip", copy.skippedChapter(chapter.number));
      return !exists;
    })
    : stats.chapters;

  if (!chaptersToUpload.length) {
    toast(copy.nothingImported(), "error");
    return false;
  }

  saveTokenPreference(settings);

  const progress = modal.querySelector("[data-imgchest-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: chaptersToUpload.length, text: copy.preparing() });

  const imported = [];
  const failed = [];

  try {
    for (let index = 0; index < chaptersToUpload.length; index += 1) {
      const chapterGroup = chaptersToUpload[index];
      setProgress(modal, {
        done: index,
        total: chaptersToUpload.length,
        text: copy.creating(index + 1, chaptersToUpload.length, chapterGroup.number),
      });

      try {
        const result = await uploadChapterToImgChest({
          token: settings.token,
          albumName: stats.albumName,
          chapterGroup,
          titleTemplate: settings.titleTemplate,
          privacy: settings.privacy,
          batchSize: settings.batchSize,
          retry: {
            delayMs: settings.delayMs,
            rateLimitWaitMs: imgChestUploadDefaults.rateLimitWaitMs,
            maxRetries: imgChestUploadDefaults.maxRetries,
            onRateLimit: ({ waitMs, attempt, maxRetries }) => {
              addSummaryLine(modal, "skip", copy.rateLimit(Math.ceil(waitMs / 1000), attempt, maxRetries));
              setProgress(modal, {
                done: index,
                total: chaptersToUpload.length,
                text: copy.rateLimit(Math.ceil(waitMs / 1000), attempt, maxRetries),
              });
            },
          },
          onStatus: ({ phase, batchIndex, batchTotal }) => {
            if (phase === "add") {
              setProgress(modal, {
                done: index,
                total: chaptersToUpload.length,
                text: copy.addingBatch(chapterGroup.number, batchIndex + 1, batchTotal),
              });
            }
            if (phase === "refresh") {
              setProgress(modal, {
                done: index,
                total: chaptersToUpload.length,
                text: copy.refreshing(chapterGroup.number),
              });
            }
          },
        });

        imported.push({
          number: result.number,
          postId: result.postId,
          postUrl: result.postUrl,
          chapter: {
            title: chapterTitleFromTemplate(settings.chapterTitleTemplate, result.number),
            volume: "",
            last_updated: String(Math.floor(Date.now() / 1000)),
            groups: {
              [settings.groupName]: result.imageUrls,
            },
          },
        });

        addSummaryLine(modal, "ok", copy.uploadedChapter(result.number, result.imageUrls.length, result.postUrl));
      } catch (error) {
        failed.push({ number: chapterGroup.number, error });
        addSummaryLine(modal, "fail", copy.failedChapter(chapterGroup.number, error.message || String(error)));
      }

      setProgress(modal, {
        done: index + 1,
        total: chaptersToUpload.length,
        text: copy.creating(index + 1, chaptersToUpload.length, chapterGroup.number),
      });
    }

    if (!imported.length) {
      toast(copy.nothingImported(), "error");
      return false;
    }

    onSave({ imported, failed, conflictMode: settings.conflictMode });
    toast(copy.done(imported.length), "success");
    return true;
  } catch (error) {
    toast(error.message || String(error), "error");
    return false;
  } finally {
    setBusy(false);
    disableForm(form, false);
    updateSelectionPreview(form);
  }
}

export function showImgChestBatchUploadModal({ onSave }) {
  const preferences = loadPreferences();
  const savedToken = getSavedImgChestToken();
  const modal = document.createElement("div");
  modal.className = "drawer-backdrop";
  modal.innerHTML = `
    <aside class="chapter-drawer multi-chapter-drawer">
      <div class="drawer-header">
        <div>
          <p class="kicker">${copy.kicker()}</p>
          <h2>${copy.title()}</h2>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>${copy.close()}</button>
      </div>

      <form id="imgchest-batch-upload-form" class="drawer-form multi-chapter-form" autocomplete="off">
        <div class="multi-chapter-scroll-area">
          <label class="field">
            <span>${copy.token()}</span>
            <input name="token" type="password" value="${attr(savedToken)}" required />
            <p class="hint">${copy.tokenHint()}</p>
          </label>

          <label class="checkbox-line">
            <input name="rememberToken" type="checkbox" ${savedToken ? "checked" : ""} />
            <span>${copy.rememberToken()}</span>
          </label>

          <label class="field">
            <span>${copy.folderInput()}</span>
            <input name="folder" type="file" accept="${SUPPORTED_LOCAL_IMAGE_ACCEPT}" multiple webkitdirectory directory required />
            <p class="hint">${copy.folderHint()}</p>
          </label>

          <div class="notice">
            <strong data-imgchest-selection>${copy.selectionEmpty()}</strong>
          </div>

          <div class="drawer-grid chapter-meta-grid">
            <label class="field">
              <span>${copy.privacy()}</span>
              <select name="privacy">
                <option value="hidden" ${(preferences.privacy || imgChestUploadDefaults.privacy) === "hidden" ? "selected" : ""}>${copy.hidden()}</option>
                <option value="public" ${preferences.privacy === "public" ? "selected" : ""}>${copy.public()}</option>
                <option value="secret" ${preferences.privacy === "secret" ? "selected" : ""}>${copy.secret()}</option>
              </select>
            </label>
            <label class="field">
              <span>${copy.group()}</span>
              <input name="groupName" value="${attr(preferences.groupName || "")}" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.batchSize()}</span>
              <input name="batchSize" type="number" min="1" max="20" step="1" value="${attr(preferences.batchSize || imgChestUploadDefaults.batchSize)}" />
            </label>
            <label class="field">
              <span>${copy.delay()}</span>
              <input name="delayMs" type="number" min="0" step="50" value="${attr(preferences.delayMs || imgChestUploadDefaults.delayMs)}" />
            </label>
          </div>

          <label class="field">
            <span>${copy.titleTemplate()}</span>
            <input name="titleTemplate" value="${attr(preferences.titleTemplate || "{album} {chapter}")}" placeholder="${attr(copy.titleTemplatePlaceholder())}" />
            <p class="hint">${copy.titleTemplateHint()}</p>
          </label>

          <label class="field">
            <span>${copy.chapterTitleTemplate()}</span>
            <input name="chapterTitleTemplate" value="${attr(preferences.chapterTitleTemplate || "")}" placeholder="${attr(copy.chapterTitleTemplatePlaceholder())}" />
          </label>

          <label class="field">
            <span>${copy.conflictMode()}</span>
            <select name="conflictMode">
              <option value="cancel" ${preferences.conflictMode === "cancel" ? "selected" : ""}>${copy.conflictCancel()}</option>
              <option value="skip" ${(preferences.conflictMode || "skip") === "skip" ? "selected" : ""}>${copy.conflictSkip()}</option>
              <option value="replace" ${preferences.conflictMode === "replace" ? "selected" : ""}>${copy.conflictReplace()}</option>
              <option value="merge" ${preferences.conflictMode === "merge" ? "selected" : ""}>${copy.conflictMerge()}</option>
            </select>
          </label>
          <p class="hint">${copy.preferencesHint()}</p>

          <section class="multi-chapter-progress" data-imgchest-progress hidden>
            <div class="multi-chapter-progress-head">
              <div class="multi-chapter-spinner" aria-hidden="true"></div>
              <div>
                <h3>${copy.summary()}</h3>
                <p data-imgchest-status>${copy.preparing()}</p>
              </div>
            </div>
            <div class="multi-chapter-bar" aria-hidden="true"><span data-imgchest-bar></span></div>
            <div class="multi-chapter-summary" data-imgchest-summary></div>
          </section>
        </div>

        <div class="drawer-actions multi-chapter-actions">
          <button class="btn primary" type="submit">${copy.startUpload()}</button>
          <button class="btn ghost" type="button" data-close-modal>${copy.cancel()}</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#imgchest-batch-upload-form");
  const close = () => modal.remove();
  const remember = () => savePreferences(form);

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.folder?.addEventListener("change", () => updateSelectionPreview(form));
  form.privacy?.addEventListener("change", remember);
  form.groupName?.addEventListener("input", remember);
  form.batchSize?.addEventListener("input", remember);
  form.delayMs?.addEventListener("input", remember);
  form.titleTemplate?.addEventListener("input", remember);
  form.chapterTitleTemplate?.addEventListener("input", remember);
  form.conflictMode?.addEventListener("change", remember);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const uploaded = await runUpload({ modal, form, onSave });
    if (uploaded) close();
  });

  updateSelectionPreview(form);
}

export function imgChestBatchUploadButtonLabel() {
  return copy.button();
}
