import { state, getSavedImgChestToken, IMG_TOKEN_KEY } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { t } from "../i18n.js";
import { formatBytes } from "../image-processing.js";
import { collectLocalChapterStats, SUPPORTED_LOCAL_IMAGE_ACCEPT } from "../batch-chapter-files.js";
import { imgChestUploadDefaults, uploadChapterToImgChest } from "../imgchest-api.js";

const PREFERENCES_KEY = "adder-pages:imgchest-batch-upload-preferences";
const LARGE_BATCH_CHAPTERS = 10;
const LARGE_BATCH_IMAGES = 500;
const LARGE_BATCH_BYTES = 700 * 1024 * 1024;
const AUTO_POST_TITLE_TEMPLATE = "{album} {chapter}";

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
  folderHint: () => label("Selecione a pasta da obra. Cada subpasta numerada vira um capítulo, como 0085/, 0086/ ou 0097.5/.", "Select the work folder. Each numbered subfolder becomes a chapter, such as 0085/, 0086/, or 0097.5/."),
  safetyHint: () => label(
    `Padrão seguro fixo: ${imgChestUploadDefaults.batchSize} imagens por request, ${imgChestUploadDefaults.delayMs / 1000}s entre requests e apenas 1 retry. Capítulos que já existem no JSON são pulados antes de chamar a API. Cada capítulo concluído entra no editor imediatamente.`,
    `Fixed safe default: ${imgChestUploadDefaults.batchSize} images per request, ${imgChestUploadDefaults.delayMs / 1000}s between requests, and only 1 retry. Chapters that already exist in the JSON are skipped before calling the API. Each completed chapter is added to the editor immediately.`,
  ),
  group: () => label("Grupo", "Group"),
  chapterTitleTemplate: () => label("Título automático", "Automatic title"),
  chapterTitleTemplatePlaceholder: () => label("opcional, ex: Capítulo {n}", "optional, e.g. Chapter {n}"),
  selectionEmpty: () => label("Nenhuma pasta selecionada ainda.", "No folder selected yet."),
  selectionSummary: (chapters, images, size) => label(`${chapters} capítulos detectados · ${images} imagens · ${size}`, `${chapters} chapters detected · ${images} images · ${size}`),
  detectedPreview: (items, remaining) => label(`Detectado: ${items}${remaining > 0 ? ` +${remaining} capítulo(s)` : ""}`, `Detected: ${items}${remaining > 0 ? ` +${remaining} chapter(s)` : ""}`),
  skipNoNumber: (folder) => label(`Pasta ignorada sem número detectável: ${folder}`, `Skipped folder with no detectable number: ${folder}`),
  duplicateChapter: (number, folders) => label(`Capítulo ${number} aparece em mais de uma pasta: ${folders.join(" | ")}`, `Chapter ${number} appears in more than one folder: ${folders.join(" | ")}`),
  duplicateBlocked: () => label("Há capítulos duplicados em pastas diferentes. Renomeie/remova as duplicatas antes de enviar.", "There are duplicate chapters in different folders. Rename/remove duplicates before uploading."),
  largeBatchWarning: () => label("Lote grande. O upload pode demorar bastante, mas o Adder vai respeitar o ritmo seguro automaticamente.", "Large batch. Upload may take a while, but Adder will automatically use the safe pace."),
  confirmLargeBatch: (chapters, images, size) => label(`Você está prestes a enviar ${chapters} capítulo(s), ${images} imagem(ns), ${size}. Continuar?`, `You are about to upload ${chapters} chapter(s), ${images} image(s), ${size}. Continue?`),
  missingToken: () => label("Informe um token do ImgChest.", "Enter an ImgChest token."),
  noFiles: () => label("Selecione uma pasta com imagens.", "Select a folder with images."),
  noChapters: () => label("Nenhuma subpasta com número de capítulo foi detectada.", "No chapter-numbered subfolders were detected."),
  preparing: () => label("Preparando lote...", "Preparing batch..."),
  creating: (current, total, number) => label(`Criando post do capítulo ${number} (${current}/${total})`, `Creating post for chapter ${number} (${current}/${total})`),
  addingBatch: (number, batch, total) => label(`Capítulo ${number}: adicionando request ${batch}/${total}`, `Chapter ${number}: adding request ${batch}/${total}`),
  refreshing: (number) => label(`Capítulo ${number}: buscando links finais`, `Chapter ${number}: fetching final links`),
  rollingBack: (number) => label(`Capítulo ${number}: apagando post parcial do ImgChest`, `Chapter ${number}: deleting partial ImgChest post`),
  rateLimit: (seconds, attempt, max) => label(`Limite da API atingido. Esperando ${seconds}s antes do único retry (${attempt}/${max}).`, `API rate limit reached. Waiting ${seconds}s before the single retry (${attempt}/${max}).`),
  uploadIntro: (albumName, chapters, images, size) => label(`${albumName}: ${chapters} capítulo(s), ${images} imagem(ns), ${size}.`, `${albumName}: ${chapters} chapter(s), ${images} image(s), ${size}.`),
  uploadStart: (chapters) => label(`Iniciando upload de ${chapters} capítulo(s).`, `Starting upload of ${chapters} chapter(s).`),
  creatingPostWithImages: (number, images) => label(`Capítulo ${number}: criando post no ImgChest com ${images} imagem(ns).`, `Chapter ${number}: creating ImgChest post with ${images} image(s).`),
  uploadedChapter: (number, count, url) => label(`Capítulo ${number}: ${count} imagens enviadas — ${url}`, `Chapter ${number}: ${count} images uploaded — ${url}`),
  appliedChapter: (number) => label(`Capítulo ${number}: adicionado ao editor.`, `Chapter ${number}: added to the editor.`),
  skippedChapter: (number) => label(`Capítulo ${number} pulado porque já existe no JSON.`, `Chapter ${number} skipped because it already exists in the JSON.`),
  failedChapter: (number, message) => label(`Capítulo ${number}: falhou — ${message}`, `Chapter ${number}: failed — ${message}`),
  nothingImported: () => label("Nenhum capítulo novo foi importado.", "No new chapters were imported."),
  stoppedWithPartial: (imported, failedNumber) => label(
    `Upload interrompido no capítulo ${failedNumber}. ${imported} capítulo(s) concluído(s) já foram adicionados ao editor. Clique em Salvar no GitHub para gravar o JSON.`,
    `Upload stopped at chapter ${failedNumber}. ${imported} completed chapter(s) were already added to the editor. Click Save to GitHub to write the JSON.`,
  ),
  done: (count) => label(`${count} capítulos adicionados ao editor. Clique em Salvar no GitHub para gravar o JSON.`, `${count} chapters added to the editor. Click Save to GitHub to write the JSON.`),
  summary: () => label("Resumo", "Summary"),
  console: () => label("Console de upload", "Upload console"),
  consoleHint: () => label("Acompanhe cada etapa do envio em tempo real.", "Follow every upload step in real time."),
  stats: (done, total, ok, failed, skipped) => label(`Processados: ${done}/${total} · OK: ${ok} · Falhas: ${failed} · Pulados: ${skipped}`, `Processed: ${done}/${total} · OK: ${ok} · Failed: ${failed} · Skipped: ${skipped}`),
  startUpload: () => label("Enviar lote para ImgChest", "Upload batch to ImgChest"),
  close: () => t("close") || label("Fechar", "Close"),
  cancel: () => t("cancel") || label("Cancelar", "Cancel"),
  preferencesHint: () => label("O Adder lembra grupo e título automático neste navegador. Capítulos já existentes são pulados automaticamente antes do upload.", "Adder remembers group and automatic title in this browser. Existing chapters are automatically skipped before upload."),
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
      groupName: String(form.groupName?.value || ""),
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
  return stats.chapters.length >= LARGE_BATCH_CHAPTERS || stats.imageCount > LARGE_BATCH_IMAGES || stats.size > LARGE_BATCH_BYTES;
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

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function addConsoleLine(modal, level, text) {
  const consoleEl = modal.querySelector("[data-imgchest-console]");
  if (!consoleEl) return;
  const line = document.createElement("div");
  line.className = `upload-console-line ${level}`;
  line.innerHTML = `<span class="time">[${timestamp()}]</span> <span class="level">${String(level || "info").toUpperCase()}</span> <span class="message"></span>`;
  line.querySelector(".message").textContent = text;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function updateConsoleStats(modal, { processed = 0, total = 0, ok = 0, failed = 0, skipped = 0 } = {}) {
  const stats = modal.querySelector("[data-imgchest-console-stats]");
  if (!stats) return;
  stats.textContent = copy.stats(processed, total, ok, failed, skipped);
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
  return {
    token: String(formData.get("token") || "").trim(),
    rememberToken: Boolean(formData.get("rememberToken")),
    privacy: imgChestUploadDefaults.privacy,
    groupName: String(formData.get("groupName") || "").trim(),
    titleTemplate: AUTO_POST_TITLE_TEMPLATE,
    chapterTitleTemplate: String(formData.get("chapterTitleTemplate") || "").trim(),
    conflictMode: "skip",
  };
}

function chapterTitleFromTemplate(template, number) {
  return template ? template.replaceAll("{n}", number).replaceAll("{chapter}", number) : "";
}

function saveTokenPreference(settings) {
  try {
    if (settings.rememberToken) localStorage.setItem(IMG_TOKEN_KEY, settings.token);
    else localStorage.removeItem(IMG_TOKEN_KEY);
  } catch {
    // Ignore localStorage errors.
  }
}

function chapterExistsInEditor(number) {
  return Object.prototype.hasOwnProperty.call(state.current?.data?.chapters || {}, number);
}

function buildImportedChapter(settings, result) {
  return {
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
  };
}

async function runUpload({ modal, form, onSave, onChapterUploaded }) {
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
  if (isLargeBatch(stats) && !confirm(copy.confirmLargeBatch(stats.chapters.length, stats.imageCount, formatBytes(stats.size)))) {
    return false;
  }

  saveTokenPreference(settings);
  modal.querySelector("[data-imgchest-progress]")?.removeAttribute("hidden");
  disableForm(form, true);
  setBusy(true);

  const imported = [];
  const skipped = [];
  let failed = null;
  let processed = 0;

  setProgress(modal, { done: 0, total: stats.chapters.length, text: copy.preparing() });
  updateConsoleStats(modal, { processed: 0, total: stats.chapters.length, ok: 0, failed: 0, skipped: 0 });
  addConsoleLine(modal, "info", copy.safetyHint());
  addConsoleLine(modal, "info", copy.uploadIntro(stats.albumName, stats.chapters.length, stats.imageCount, formatBytes(stats.size)));
  addConsoleLine(modal, "info", copy.uploadStart(stats.chapters.length));

  try {
    for (let index = 0; index < stats.chapters.length; index += 1) {
      const chapterGroup = stats.chapters[index];

      if (chapterExistsInEditor(chapterGroup.number)) {
        skipped.push(chapterGroup.number);
        processed += 1;
        addSummaryLine(modal, "skip", copy.skippedChapter(chapterGroup.number));
        addConsoleLine(modal, "warn", copy.skippedChapter(chapterGroup.number));
        setProgress(modal, { done: processed, total: stats.chapters.length, text: copy.skippedChapter(chapterGroup.number) });
        updateConsoleStats(modal, { processed, total: stats.chapters.length, ok: imported.length, failed: 0, skipped: skipped.length });
        continue;
      }

      const currentText = copy.creating(index + 1, stats.chapters.length, chapterGroup.number);
      setProgress(modal, { done: processed, total: stats.chapters.length, text: currentText });
      addConsoleLine(modal, "info", currentText);

      try {
        const result = await uploadChapterToImgChest({
          token: settings.token,
          albumName: stats.albumName,
          chapterGroup,
          titleTemplate: settings.titleTemplate,
          privacy: settings.privacy,
          retry: {
            onRateLimit: ({ waitMs, attempt, maxRetries }) => {
              const message = copy.rateLimit(Math.ceil(waitMs / 1000), attempt, maxRetries);
              addSummaryLine(modal, "skip", message);
              addConsoleLine(modal, "warn", message);
              setProgress(modal, { done: processed, total: stats.chapters.length, text: message });
            },
          },
          onStatus: ({ phase, batchIndex, batchTotal }) => {
            if (phase === "create") addConsoleLine(modal, "info", copy.creatingPostWithImages(chapterGroup.number, chapterGroup.files.length));
            if (phase === "add") {
              const message = copy.addingBatch(chapterGroup.number, batchIndex + 1, batchTotal);
              addConsoleLine(modal, "info", message);
              setProgress(modal, { done: processed, total: stats.chapters.length, text: message });
            }
            if (phase === "refresh") {
              const message = copy.refreshing(chapterGroup.number);
              addConsoleLine(modal, "info", message);
              setProgress(modal, { done: processed, total: stats.chapters.length, text: message });
            }
            if (phase === "rollback") {
              const message = copy.rollingBack(chapterGroup.number);
              addConsoleLine(modal, "warn", message);
              setProgress(modal, { done: processed, total: stats.chapters.length, text: message });
            }
          },
        });

        const importedItem = buildImportedChapter(settings, result);
        imported.push(importedItem);
        onChapterUploaded?.({ ...importedItem, conflictMode: settings.conflictMode });
        processed += 1;

        const successMessage = copy.uploadedChapter(result.number, result.imageUrls.length, result.postUrl);
        addSummaryLine(modal, "ok", successMessage);
        addConsoleLine(modal, "success", successMessage);
        addConsoleLine(modal, "success", copy.appliedChapter(result.number));
        setProgress(modal, { done: processed, total: stats.chapters.length, text: successMessage });
        updateConsoleStats(modal, { processed, total: stats.chapters.length, ok: imported.length, failed: 0, skipped: skipped.length });
      } catch (error) {
        failed = { number: chapterGroup.number, error };
        processed += 1;
        const errorText = copy.failedChapter(chapterGroup.number, error.message || String(error));
        addSummaryLine(modal, "fail", errorText);
        addConsoleLine(modal, "error", errorText);
        updateConsoleStats(modal, { processed, total: stats.chapters.length, ok: imported.length, failed: 1, skipped: skipped.length });
        break;
      }
    }

    if (!imported.length) {
      addConsoleLine(modal, failed ? "error" : "warn", copy.nothingImported());
      toast(copy.nothingImported(), failed ? "error" : "warning");
      return false;
    }

    onSave?.({ imported, skipped, failed: failed ? [failed] : [], conflictMode: settings.conflictMode, alreadyApplied: Boolean(onChapterUploaded) });

    if (failed) {
      const message = copy.stoppedWithPartial(imported.length, failed.number);
      addConsoleLine(modal, "warn", message);
      addSummaryLine(modal, "skip", message);
      toast(message, "warning");
      return true;
    }

    addConsoleLine(modal, "success", copy.done(imported.length));
    toast(copy.done(imported.length), "success");
    return true;
  } catch (error) {
    addConsoleLine(modal, "error", error.message || String(error));
    toast(error.message || String(error), "error");
    return imported.length > 0;
  } finally {
    setBusy(false);
    disableForm(form, false);
    updateSelectionPreview(form);
  }
}

export function showImgChestBatchUploadModal({ onSave, onChapterUploaded } = {}) {
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

          <div class="notice">
            <strong>${copy.safetyHint()}</strong>
          </div>

          <div class="drawer-grid">
            <label class="field">
              <span>${copy.group()}</span>
              <input name="groupName" value="${attr(preferences.groupName || "")}" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.chapterTitleTemplate()}</span>
              <input name="chapterTitleTemplate" value="${attr(preferences.chapterTitleTemplate || "")}" placeholder="${attr(copy.chapterTitleTemplatePlaceholder())}" />
            </label>
          </div>
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
            <div class="upload-console-head">
              <div>
                <strong>${copy.console()}</strong>
                <p>${copy.consoleHint()}</p>
              </div>
              <span data-imgchest-console-stats>${copy.stats(0, 0, 0, 0, 0)}</span>
            </div>
            <div class="upload-console" data-imgchest-console></div>
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
  form.groupName?.addEventListener("input", remember);
  form.chapterTitleTemplate?.addEventListener("input", remember);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const uploaded = await runUpload({ modal, form, onSave, onChapterUploaded });
    if (uploaded) close();
  });

  updateSelectionPreview(form);
}

export function imgChestBatchUploadButtonLabel() {
  return copy.button();
}
