import { state } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { t } from "../i18n.js";
import { ensureClient } from "../repo.js";
import { filterImageFiles, formatBytes, sumBytes, imageProcessingDefaults } from "../image-processing.js";
import { resizeImagesKeepingFormat } from "../image-resize-original-format.js";
import { buildGithubImageUploadItems, buildGithubImageFolder, githubImageDefaults } from "../github-image-links.js";
import { extractChapterNumberFromTitle, normalizeChapterNumber, isValidChapterNumber } from "../chapter-number.js";

const BATCH_PREFERENCES_KEY = "adder-pages:github-folder-upload-preferences";
const LARGE_BATCH_CHAPTERS = 10;
const LARGE_BATCH_IMAGES = 300;
const LARGE_BATCH_BYTES = 500 * 1024 * 1024;

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

const copy = {
  button: () => label("Upload lote local", "Local batch upload"),
  kicker: () => label("Upload local em lote", "Local batch upload"),
  title: () => label("Enviar várias pastas para o GitHub", "Upload multiple folders to GitHub"),
  folderInput: () => label("Pasta com capítulos", "Folder with chapters"),
  folderHint: () => label("Selecione uma pasta com subpastas de capítulos, como 0085/, 0086/, 0087/. O Adder redimensiona para largura máxima de 1100 px e mantém o formato original: JPG, PNG ou WebP.", "Select a folder with chapter subfolders, such as 0085/, 0086/, 0087/. Adder resizes to a max width of 1100 px and preserves the original format: JPG, PNG, or WebP."),
  imagesRoot: () => label("Pasta base das imagens", "Images root folder"),
  maxWidth: () => label("Largura máxima", "Max width"),
  quality: () => label("Qualidade JPG/WebP", "JPG/WebP quality"),
  linkMode: () => label("Tipo de link", "Link type"),
  rawMode: () => label("Raw GitHub", "Raw GitHub"),
  pagesMode: () => label("GitHub Pages", "GitHub Pages"),
  pagesWarning: () => label("Use GitHub Pages apenas se o repositório tiver Pages publicado e público. Se estiver em dúvida, use Raw GitHub.", "Use GitHub Pages only if this repository has public Pages enabled. If unsure, use Raw GitHub."),
  conflictMode: () => label("Se o capítulo já existir", "If the chapter already exists"),
  conflictCancel: () => label("Cancelar tudo", "Cancel all"),
  conflictSkip: () => label("Pular existentes", "Skip existing"),
  conflictReplace: () => label("Substituir capítulo", "Replace chapter"),
  conflictMerge: () => label("Substituir imagens do grupo", "Replace group images"),
  group: () => label("Grupo", "Group"),
  titleTemplate: () => label("Título automático", "Automatic title"),
  titleTemplatePlaceholder: () => label("opcional, ex: Capítulo {n}", "optional, e.g. Chapter {n}"),
  startUpload: () => label("Processar e enviar lote", "Process and upload batch"),
  close: () => t("close") || label("Fechar", "Close"),
  cancel: () => t("cancel") || label("Cancelar", "Cancel"),
  noFiles: () => label("Selecione uma pasta com imagens.", "Select a folder with images."),
  noChapters: () => label("Nenhuma subpasta com número de capítulo foi detectada.", "No chapter-numbered subfolders were detected."),
  selectionEmpty: () => label("Nenhuma pasta selecionada ainda.", "No folder selected yet."),
  selectionSummary: (chapters, images, size) => label(`${chapters} capítulos detectados · ${images} imagens · ${size}`, `${chapters} chapters detected · ${images} images · ${size}`),
  detectedPreview: (items, remaining) => label(`Detectado: ${items}${remaining > 0 ? ` +${remaining} capítulo(s)` : ""}`, `Detected: ${items}${remaining > 0 ? ` +${remaining} chapter(s)` : ""}`),
  destinationPreview: (items, remaining) => label(`Destino: ${items}${remaining > 0 ? ` +${remaining} destino(s)` : ""}`, `Destination: ${items}${remaining > 0 ? ` +${remaining} destination(s)` : ""}`),
  skipNoNumber: (folder) => label(`Pasta ignorada sem número detectável: ${folder}`, `Skipped folder with no detectable number: ${folder}`),
  duplicateChapter: (number, folders) => label(`Capítulo ${number} aparece em mais de uma pasta: ${folders.join(" | ")}`, `Chapter ${number} appears in more than one folder: ${folders.join(" | ")}`),
  duplicateBlocked: () => label("Há capítulos duplicados em pastas diferentes. Renomeie/remova as duplicatas antes de enviar.", "There are duplicate chapters in different folders. Rename/remove duplicates before uploading."),
  largeBatchWarning: () => label("Lote grande. O upload pode demorar e deixar o repositório pesado.", "Large batch. Upload may take a while and make the repository heavy."),
  confirmLargeBatch: (chapters, images, size) => label(`Você está prestes a processar ${chapters} capítulo(s), ${images} imagem(ns), ${size}. Continuar?`, `You are about to process ${chapters} chapter(s), ${images} image(s), ${size}. Continue?`),
  chapterExists: (number) => label(`Capítulo ${number} já existe.`, `Chapter ${number} already exists.`),
  confirmReplace: (count) => label(`${count} capítulo(s) existente(s) serão substituídos/mesclados no JSON. Continuar?`, `${count} existing chapter(s) will be replaced/merged in the JSON. Continue?`),
  preparing: () => label("Preparando lote...", "Preparing batch..."),
  checkingFolder: (current, total, number) => label(`Verificando pasta do capítulo ${number} (${current}/${total})`, `Checking chapter ${number} folder (${current}/${total})`),
  processingChapter: (current, total, number) => label(`Redimensionando capítulo ${number} (${current}/${total})`, `Resizing chapter ${number} (${current}/${total})`),
  processingImage: (current, total, name) => label(`Redimensionando ${current}/${total} — ${name}`, `Resizing ${current}/${total} — ${name}`),
  uploadingChapter: (current, total, number) => label(`Enviando capítulo ${number} (${current}/${total})`, `Uploading chapter ${number} (${current}/${total})`),
  existingFolder: (number, count) => label(`Capítulo ${number}: pasta existente encontrada com ${count} arquivo(s).`, `Chapter ${number}: existing folder found with ${count} file(s).`),
  confirmOverwriteFolder: (number, count) => label(`Capítulo ${number}: a pasta já existe no GitHub com ${count} arquivo(s). Continuar e sobrescrever arquivos com o mesmo nome?`, `Chapter ${number}: the folder already exists on GitHub with ${count} file(s). Continue and overwrite files with the same name?`),
  overwriteCancelled: (number) => label(`Capítulo ${number}: sobrescrita cancelada pelo usuário.`, `Chapter ${number}: overwrite cancelled by the user.`),
  uploadedChapter: (number, count) => label(`Capítulo ${number}: ${count} imagens enviadas.`, `Chapter ${number}: ${count} images uploaded.`),
  skippedChapter: (number) => label(`Capítulo ${number} pulado porque já existe.`, `Chapter ${number} skipped because it already exists.`),
  failedChapter: (number, message) => label(`Capítulo ${number}: falhou — ${message}`, `Chapter ${number}: failed — ${message}`),
  done: (count) => label(`${count} capítulos importados. Clique em Salvar no GitHub para gravar o JSON.`, `${count} chapters imported. Click Save to GitHub to write the JSON.`),
  preferencesHint: () => label("O Adder lembra pasta base, largura, qualidade, tipo de link e modo de conflito neste navegador.", "Adder remembers root folder, width, quality, link type, and conflict mode in this browser."),
  resizeHint: () => label("As imagens são reduzidas proporcionalmente para no máximo 1100 px de largura. O formato é mantido: .jpg, .png ou .webp.", "Images are proportionally reduced to a maximum width of 1100 px. Format is preserved: .jpg, .png, or .webp."),
  originalSize: () => label("Tamanho original", "Original size"),
  finalSize: () => label("Tamanho final", "Final size"),
  summary: () => label("Resumo", "Summary"),
};

function loadPreferences() {
  try {
    return JSON.parse(localStorage.getItem(BATCH_PREFERENCES_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function savePreferences(form) {
  try {
    localStorage.setItem(BATCH_PREFERENCES_KEY, JSON.stringify({
      imagesRoot: String(form.imagesRoot?.value || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot,
      maxWidth: String(form.maxWidth?.value || imageProcessingDefaults.maxWidth),
      quality: String(form.quality?.value || 85),
      linkMode: String(form.linkMode?.value || githubImageDefaults.linkMode),
      conflictMode: String(form.conflictMode?.value || "skip"),
    }));
  } catch {
    // Ignore storage errors.
  }
}

function getJsonFileName() {
  return state.current?.name || "manga.json";
}

function imagesRootFromForm(form) {
  return String(form.imagesRoot?.value || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot;
}

function destinationForChapter(form, number) {
  return buildGithubImageFolder({
    imagesRoot: imagesRootFromForm(form),
    jsonFileName: getJsonFileName(),
    chapterNumber: number,
  });
}

function getRelativePath(file) {
  return String(file.webkitRelativePath || file.name || "");
}

function getPathSegments(file) {
  return getRelativePath(file).split("/").filter(Boolean);
}

function chapterFolderInfoForFile(file) {
  const parts = getPathSegments(file);
  const folderParts = parts.slice(0, -1);

  for (let index = folderParts.length - 1; index >= 0; index -= 1) {
    const folder = folderParts[index];
    const number = extractChapterNumberFromTitle(folder);
    if (number && isValidChapterNumber(number)) {
      return {
        folder,
        number: normalizeChapterNumber(number),
        folderPath: folderParts.slice(0, index + 1).join("/"),
      };
    }
  }

  return null;
}

function collectChapterGroups(files = []) {
  const groups = new Map();
  const skipped = [];
  const duplicatePaths = new Map();

  filterImageFiles(files).forEach((file) => {
    const info = chapterFolderInfoForFile(file);
    const skippedFolder = getPathSegments(file).slice(0, -1).join("/") || file.name;

    if (!info) {
      if (!skipped.includes(skippedFolder)) skipped.push(skippedFolder);
      return;
    }

    if (groups.has(info.number) && groups.get(info.number).folderPath !== info.folderPath) {
      const paths = duplicatePaths.get(info.number) || new Set([groups.get(info.number).folderPath]);
      paths.add(info.folderPath);
      duplicatePaths.set(info.number, paths);
      return;
    }

    if (!groups.has(info.number)) {
      groups.set(info.number, {
        number: info.number,
        folder: info.folder,
        folderPath: info.folderPath,
        files: [],
      });
    }

    groups.get(info.number).files.push(file);
  });

  const duplicates = [...duplicatePaths.entries()].map(([number, paths]) => ({
    number,
    folders: [...paths],
  }));

  return {
    chapters: [...groups.values()].sort((a, b) => Number.parseFloat(a.number) - Number.parseFloat(b.number)),
    skipped,
    duplicates,
  };
}

function selectedStats(form) {
  const files = Array.from(form.querySelector("input[name='folder']")?.files || []);
  const { chapters, skipped, duplicates } = collectChapterGroups(files);
  const imageCount = chapters.reduce((sum, chapter) => sum + chapter.files.length, 0);
  const size = chapters.reduce((sum, chapter) => sum + chapter.files.reduce((total, file) => total + (Number(file.size) || 0), 0), 0);
  return { files, chapters, skipped, duplicates, imageCount, size };
}

function isLargeBatch(stats) {
  return stats.chapters.length > LARGE_BATCH_CHAPTERS || stats.imageCount > LARGE_BATCH_IMAGES || stats.size > LARGE_BATCH_BYTES;
}

function updateSelectionPreview(form) {
  const preview = form.querySelector("[data-folder-upload-selection]");
  if (!preview) return;

  const stats = selectedStats(form);
  if (!stats.chapters.length) {
    preview.textContent = copy.selectionEmpty();
    preview.classList.remove("warning");
    return;
  }

  const first = stats.chapters.slice(0, 6).map((chapter) => `${chapter.number} (${chapter.files.length})`).join(" → ");
  const destinations = stats.chapters.slice(0, 4).map((chapter) => `${chapter.number} → ${destinationForChapter(form, chapter.number)}`).join(" | ");
  const remaining = Math.max(0, stats.chapters.length - 6);
  const remainingDestinations = Math.max(0, stats.chapters.length - 4);
  const skipped = stats.skipped.map((folder) => copy.skipNoNumber(folder)).join("\n");
  const duplicates = stats.duplicates.map((item) => copy.duplicateChapter(item.number, item.folders)).join("\n");
  const warning = isLargeBatch(stats) ? `\n${copy.largeBatchWarning()}` : "";
  preview.textContent = `${copy.selectionSummary(stats.chapters.length, stats.imageCount, formatBytes(stats.size))}\n${copy.detectedPreview(first, remaining)}\n${copy.destinationPreview(destinations, remainingDestinations)}${skipped ? `\n${skipped}` : ""}${duplicates ? `\n${duplicates}` : ""}${warning}`;
  preview.classList.toggle("warning", isLargeBatch(stats) || Boolean(stats.duplicates.length));
}

function updatePagesWarning(form) {
  const warning = form.querySelector("[data-folder-pages-warning]");
  if (!warning) return;
  warning.hidden = form.linkMode?.value !== "pages";
}

function setProgress(modal, { done, total, text }) {
  const status = modal.querySelector("[data-folder-upload-status]");
  const bar = modal.querySelector("[data-folder-upload-bar]");
  const progress = total ? Math.round((done / total) * 100) : 0;
  if (status) status.textContent = text || copy.preparing();
  if (bar) bar.style.setProperty("--progress", `${progress}%`);
}

function addSummaryLine(modal, className, text) {
  const summary = modal.querySelector("[data-folder-upload-summary]");
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
  const qualityPercent = Number(formData.get("quality") || 85);
  const quality = Math.min(1, Math.max(0.1, qualityPercent / 100));
  const maxWidth = Math.max(100, Number(formData.get("maxWidth") || imageProcessingDefaults.maxWidth));

  return {
    groupName: String(formData.get("groupName") || "").trim(),
    titleTemplate: String(formData.get("titleTemplate") || "").trim(),
    imagesRoot: String(formData.get("imagesRoot") || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot,
    conflictMode: String(formData.get("conflictMode") || "skip"),
    linkMode: String(formData.get("linkMode") || githubImageDefaults.linkMode),
    maxWidth,
    quality,
  };
}

function chapterFolderForGroup(chapterGroup, settings) {
  return buildGithubImageFolder({
    imagesRoot: settings.imagesRoot,
    jsonFileName: getJsonFileName(),
    chapterNumber: chapterGroup.number,
  });
}

async function getExistingFolderFiles(client, folderPath) {
  try {
    const contents = await client.listContents({
      ...state.config,
      path: folderPath,
    });

    const items = Array.isArray(contents) ? contents : [contents];
    const fileShas = new Map();

    items.forEach((item) => {
      if (item?.type === "file" && item.name && item.sha) {
        fileShas.set(item.name, item.sha);
      }
    });

    return {
      exists: true,
      fileCount: fileShas.size,
      fileShas,
    };
  } catch (error) {
    if (error.status === 404) {
      return {
        exists: false,
        fileCount: 0,
        fileShas: new Map(),
      };
    }
    throw error;
  }
}

async function uploadChapter({ modal, client, chapterGroup, settings, index, total }) {
  const jsonFileName = getJsonFileName();
  const folder = chapterFolderForGroup(chapterGroup, settings);

  setProgress(modal, {
    done: index * 3,
    total: total * 3,
    text: copy.checkingFolder(index + 1, total, chapterGroup.number),
  });

  const existingFolder = await getExistingFolderFiles(client, folder);
  if (existingFolder.exists) {
    addSummaryLine(modal, "skip", copy.existingFolder(chapterGroup.number, existingFolder.fileCount));

    if (settings.conflictMode === "skip") {
      addSummaryLine(modal, "skip", copy.skippedChapter(chapterGroup.number));
      return null;
    }

    if (settings.conflictMode === "cancel") {
      throw new Error(copy.chapterExists(chapterGroup.number));
    }

    const ok = confirm(copy.confirmOverwriteFolder(chapterGroup.number, existingFolder.fileCount));
    if (!ok) {
      addSummaryLine(modal, "skip", copy.overwriteCancelled(chapterGroup.number));
      return null;
    }
  }

  setProgress(modal, {
    done: index * 3 + 1,
    total: total * 3,
    text: copy.processingChapter(index + 1, total, chapterGroup.number),
  });

  const processed = await resizeImagesKeepingFormat(chapterGroup.files, {
    maxWidth: settings.maxWidth,
    quality: settings.quality,
    onProgress: ({ index: imageIndex, total: imageTotal, file }) => {
      setProgress(modal, {
        done: index * 3 + 1,
        total: total * 3,
        text: copy.processingImage(imageIndex + 1, imageTotal, file.name),
      });
    },
  });

  const items = buildGithubImageUploadItems({
    config: state.config,
    jsonFileName,
    chapterNumber: chapterGroup.number,
    images: processed,
    imagesRoot: settings.imagesRoot,
    linkMode: settings.linkMode,
  }).map((item) => ({
    ...item,
    sha: existingFolder.fileShas.get(item.fileName) || null,
  }));

  setProgress(modal, {
    done: index * 3 + 2,
    total: total * 3,
    text: copy.uploadingChapter(index + 1, total, chapterGroup.number),
  });

  for (const item of items) {
    await client.putBase64File({
      ...state.config,
      path: item.path,
      base64Content: item.base64DataUrl,
      message: `${item.sha ? "Update" : "Upload"} ${item.path} via Adder Pages`,
      sha: item.sha,
    });
  }

  const title = settings.titleTemplate ? settings.titleTemplate.replaceAll("{n}", chapterGroup.number) : "";
  const chapter = {
    title,
    volume: "",
    last_updated: String(Math.floor(Date.now() / 1000)),
    groups: {
      [settings.groupName]: items.map((item) => item.url),
    },
  };

  addSummaryLine(modal, "ok", copy.uploadedChapter(chapterGroup.number, items.length));
  addSummaryLine(modal, "ok", `${copy.originalSize()}: ${formatBytes(sumBytes(processed, "originalSize"))}`);
  addSummaryLine(modal, "ok", `${copy.finalSize()}: ${formatBytes(sumBytes(processed, "size"))}`);

  return {
    number: chapterGroup.number,
    chapter,
    conflictMode: settings.conflictMode,
  };
}

async function runUpload({ modal, form, onSave }) {
  const settings = collectSettings(form);
  const stats = selectedStats(form);
  savePreferences(form);

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

  const progress = modal.querySelector("[data-folder-upload-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: stats.chapters.length * 3, text: copy.preparing() });

  try {
    if (settings.conflictMode === "skip") {
      existingChapters.forEach((chapter) => addSummaryLine(modal, "skip", copy.skippedChapter(chapter.number)));
    }

    const client = ensureClient();
    const imported = [];
    const failed = [];
    const chaptersToUpload = settings.conflictMode === "skip"
      ? stats.chapters.filter((chapter) => !Object.prototype.hasOwnProperty.call(existing, chapter.number))
      : stats.chapters;

    for (let index = 0; index < chaptersToUpload.length; index += 1) {
      const chapterGroup = chaptersToUpload[index];
      try {
        const result = await uploadChapter({ modal, client, chapterGroup, settings, index, total: chaptersToUpload.length });
        if (result) imported.push(result);
      } catch (error) {
        failed.push({ number: chapterGroup.number, error });
        addSummaryLine(modal, "fail", copy.failedChapter(chapterGroup.number, error.message || String(error)));
      }
    }

    if (!imported.length) {
      toast(label("Nenhum capítulo foi importado.", "No chapters were imported."), "error");
      return false;
    }

    onSave({ imported, failed, conflictMode: settings.conflictMode });
    setProgress(modal, { done: chaptersToUpload.length * 3, total: chaptersToUpload.length * 3, text: copy.done(imported.length) });
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

export function showGithubFolderUploadModal({ onSave }) {
  const preferences = loadPreferences();
  const imagesRoot = preferences.imagesRoot || githubImageDefaults.imagesRoot;
  const maxWidth = preferences.maxWidth || imageProcessingDefaults.maxWidth;
  const quality = preferences.quality || 85;
  const linkMode = preferences.linkMode || githubImageDefaults.linkMode;
  const conflictMode = preferences.conflictMode || "skip";
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

      <form id="github-folder-upload-form" class="drawer-form multi-chapter-form" autocomplete="off">
        <div class="multi-chapter-scroll-area">
          <label class="field">
            <span>${copy.folderInput()}</span>
            <input name="folder" type="file" accept="image/*" multiple webkitdirectory directory required />
            <p class="hint">${copy.folderHint()}</p>
          </label>

          <div class="notice">
            <strong data-folder-upload-selection>${copy.selectionEmpty()}</strong>
          </div>

          <div class="notice">
            <strong>${label("Redimensionamento", "Resize")}</strong>
            <p class="hint">${copy.resizeHint()}</p>
          </div>

          <div class="drawer-grid chapter-meta-grid">
            <label class="field">
              <span>${copy.imagesRoot()}</span>
              <input name="imagesRoot" value="${attr(imagesRoot)}" />
            </label>
            <label class="field">
              <span>${copy.group()}</span>
              <input name="groupName" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.maxWidth()}</span>
              <input name="maxWidth" type="number" min="100" step="50" value="${attr(maxWidth)}" />
            </label>
            <label class="field">
              <span>${copy.quality()}</span>
              <input name="quality" type="number" min="10" max="100" step="1" value="${attr(quality)}" />
            </label>
          </div>

          <label class="field">
            <span>${copy.titleTemplate()}</span>
            <input name="titleTemplate" placeholder="${attr(copy.titleTemplatePlaceholder())}" />
          </label>

          <div class="drawer-grid">
            <label class="field">
              <span>${copy.linkMode()}</span>
              <select name="linkMode">
                <option value="raw" ${linkMode === "raw" ? "selected" : ""}>${copy.rawMode()}</option>
                <option value="pages" ${linkMode === "pages" ? "selected" : ""}>${copy.pagesMode()}</option>
              </select>
            </label>
            <label class="field">
              <span>${copy.conflictMode()}</span>
              <select name="conflictMode">
                <option value="cancel" ${conflictMode === "cancel" ? "selected" : ""}>${copy.conflictCancel()}</option>
                <option value="skip" ${conflictMode === "skip" ? "selected" : ""}>${copy.conflictSkip()}</option>
                <option value="replace" ${conflictMode === "replace" ? "selected" : ""}>${copy.conflictReplace()}</option>
                <option value="merge" ${conflictMode === "merge" ? "selected" : ""}>${copy.conflictMerge()}</option>
              </select>
            </label>
          </div>
          <p class="hint">${copy.preferencesHint()}</p>
          <p class="hint" data-folder-pages-warning hidden>${copy.pagesWarning()}</p>

          <section class="multi-chapter-progress" data-folder-upload-progress hidden>
            <div class="multi-chapter-progress-head">
              <div class="multi-chapter-spinner" aria-hidden="true"></div>
              <div>
                <h3>${copy.summary()}</h3>
                <p data-folder-upload-status>${copy.preparing()}</p>
              </div>
            </div>
            <div class="multi-chapter-bar" aria-hidden="true"><span data-folder-upload-bar></span></div>
            <div class="multi-chapter-summary" data-folder-upload-summary></div>
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
  const form = modal.querySelector("#github-folder-upload-form");
  const close = () => modal.remove();
  const remember = () => savePreferences(form);

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.folder?.addEventListener("change", () => updateSelectionPreview(form));
  form.imagesRoot?.addEventListener("input", () => {
    remember();
    updateSelectionPreview(form);
  });
  form.maxWidth?.addEventListener("input", remember);
  form.quality?.addEventListener("input", remember);
  form.linkMode?.addEventListener("change", () => {
    remember();
    updatePagesWarning(form);
  });
  form.conflictMode?.addEventListener("change", remember);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const uploaded = await runUpload({ modal, form, onSave });
    if (uploaded) close();
  });

  updateSelectionPreview(form);
  updatePagesWarning(form);
}

export function githubFolderUploadButtonLabel() {
  return copy.button();
}
