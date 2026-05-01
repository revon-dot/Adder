import { state } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { t } from "../i18n.js";
import { ensureClient } from "../repo.js";
import { processImageFiles, filterImageFiles, formatOutputFileName, sumBytes, formatBytes, imageProcessingDefaults } from "../image-processing.js";
import { buildGithubImageUploadItems, buildGithubImageFolder, buildGithubImagePath, githubImageDefaults } from "../github-image-links.js";
import { normalizeChapterNumber, isValidChapterNumber } from "../chapter-number.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

const LARGE_SELECTION_BYTES = 250 * 1024 * 1024;
const LARGE_SELECTION_COUNT = 120;
const PREFERENCES_KEY = "adder-pages:github-image-upload-preferences";

const copy = {
  button: () => label("Upload imagens GitHub", "GitHub image upload"),
  kicker: () => label("Upload direto", "Direct upload"),
  title: () => label("Enviar imagens para o GitHub", "Upload images to GitHub"),
  chapterNumber: () => label("Capítulo", "Chapter"),
  chapterTitle: () => label("Título do capítulo", "Chapter title"),
  volume: () => label("Volume", "Volume"),
  group: () => label("Grupo", "Group"),
  imagesRoot: () => label("Pasta base das imagens", "Images root folder"),
  maxWidth: () => label("Largura máxima", "Max width"),
  quality: () => label("Qualidade JPG", "JPG quality"),
  linkMode: () => label("Tipo de link", "Link type"),
  rawMode: () => label("Raw GitHub", "Raw GitHub"),
  pagesMode: () => label("GitHub Pages", "GitHub Pages"),
  pagesWarning: () => label("Use GitHub Pages apenas se o repositório tiver Pages publicado e público. Se estiver em dúvida, use Raw GitHub.", "Use GitHub Pages only if this repository has public Pages enabled. If unsure, use Raw GitHub."),
  fileInput: () => label("Imagens", "Images"),
  fileInputHint: () => label("Selecione as páginas do capítulo. O Adder ordena por nome e renomeia como 001.jpg, 002.jpg...", "Select the chapter pages. Adder sorts by name and renames them as 001.jpg, 002.jpg..."),
  selectionEmpty: () => label("Nenhuma imagem selecionada ainda.", "No images selected yet."),
  selectionSummary: (count, size) => label(`${count} imagens selecionadas · ${size} antes da compressão`, `${count} images selected · ${size} before compression`),
  selectionOrder: (names, remaining) => label(`Ordem detectada: ${names}${remaining > 0 ? ` +${remaining} arquivo(s)` : ""}`, `Detected order: ${names}${remaining > 0 ? ` +${remaining} file(s)` : ""}`),
  selectionWarning: () => label("Seleção grande. O upload pode demorar e deixar o repositório pesado.", "Large selection. Upload may take a while and make the repository heavy."),
  confirmLargeSelection: (count, size) => label(`Você selecionou ${count} imagens (${size}) antes da compressão. Continuar mesmo assim?`, `You selected ${count} images (${size}) before compression. Continue anyway?`),
  conflictMode: () => label("Se o capítulo já existir no JSON", "If the chapter already exists in the JSON"),
  conflictCancel: () => label("Cancelar", "Cancel"),
  conflictReplace: () => label("Substituir capítulo", "Replace chapter"),
  conflictMerge: () => label("Substituir imagens do grupo", "Replace group images"),
  preferencesHint: () => label("O Adder lembra pasta, largura, qualidade, tipo de link e modo de conflito neste navegador.", "Adder remembers folder, width, quality, link type, and conflict mode in this browser."),
  startUpload: () => label("Processar e enviar", "Process and upload"),
  close: () => t("close") || label("Fechar", "Close"),
  cancel: () => t("cancel") || label("Cancelar", "Cancel"),
  invalidChapter: () => label("Informe um número de capítulo válido. Exemplos: 85, 85.5, 10.2.", "Enter a valid chapter number. Examples: 85, 85.5, 10.2."),
  selectImages: () => label("Selecione pelo menos uma imagem.", "Select at least one image."),
  chapterExists: (number) => label(`O capítulo ${number} já existe. Escolha substituir ou mesclar para continuar.`, `Chapter ${number} already exists. Choose replace or merge to continue.`),
  confirmChapterReplace: (number) => label(`O capítulo ${number} já existe no JSON. Substituir o capítulo inteiro na tela depois do upload?`, `Chapter ${number} already exists in the JSON. Replace the entire chapter on screen after upload?`),
  confirmChapterMerge: (number, group) => label(`O capítulo ${number} já existe. Mesclar/substituir apenas o grupo "${group || "sem nome"}" depois do upload?`, `Chapter ${number} already exists. Merge/replace only the "${group || "empty"}" group after upload?`),
  preparing: () => label("Preparando imagens...", "Preparing images..."),
  prechecking: (current, total, name) => label(`Pré-verificando ${current}/${total} — ${name}`, `Prechecking ${current}/${total} — ${name}`),
  checking: (current, total, name) => label(`Verificando ${current}/${total} — ${name}`, `Checking ${current}/${total} — ${name}`),
  processing: (current, total, name) => label(`Processando ${current}/${total} — ${name}`, `Processing ${current}/${total} — ${name}`),
  uploading: (current, total, name) => label(`Enviando ${current}/${total} — ${name}`, `Uploading ${current}/${total} — ${name}`),
  uploadedLine: (name, size) => label(`${name} enviado (${size}).`, `${name} uploaded (${size}).`),
  overwrittenLine: (name, size) => label(`${name} sobrescrito (${size}).`, `${name} overwritten (${size}).`),
  existingFilesFound: (count) => label(`${count} imagens já existiam e serão sobrescritas.`, `${count} images already existed and will be overwritten.`),
  confirmOverwriteFiles: (count) => label(`${count} arquivo(s) de imagem já existem no GitHub e serão sobrescritos. Continuar?`, `${count} image file(s) already exist on GitHub and will be overwritten. Continue?`),
  noExistingFiles: () => label("Nenhuma imagem existente encontrada no destino.", "No existing images found at destination."),
  done: (count) => label(`${count} imagens enviadas. Clique em Salvar no GitHub para gravar o JSON.`, `${count} images uploaded. Click Save to GitHub to write the JSON.`),
  destination: () => label("Destino", "Destination"),
  destinationHint: () => label("As imagens serão salvas nessa pasta do repositório. Depois do upload, o capítulo será atualizado na tela; para gravar o JSON, clique em Salvar no GitHub.", "Images will be saved to this repository folder. After upload, the chapter is updated on screen; to write the JSON, click Save to GitHub."),
  summary: () => label("Resumo", "Summary"),
  originalSize: () => label("Tamanho original", "Original size"),
  finalSize: () => label("Tamanho final", "Final size"),
};

function getHighestNumericChapter(chapters = {}) {
  const numbers = Object.keys(chapters)
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);

  return numbers.length ? Math.max(...numbers) : 0;
}

function getNextChapterNumber() {
  const highest = getHighestNumericChapter(state.current?.data?.chapters || {});
  return normalizeChapterNumber(String(Math.floor(highest) + 1));
}

function getJsonFileName() {
  return state.current?.name || "manga.json";
}

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
      imagesRoot: String(form.imagesRoot?.value || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot,
      maxWidth: String(form.maxWidth?.value || imageProcessingDefaults.maxWidth),
      quality: String(form.quality?.value || 85),
      linkMode: String(form.linkMode?.value || githubImageDefaults.linkMode),
      conflictMode: String(form.conflictMode?.value || "cancel"),
    }));
  } catch {
    // Ignore storage errors. Upload still works without saved preferences.
  }
}

function selectedImageStats(form) {
  const files = Array.from(form.querySelector("input[name='images']")?.files || []);
  return {
    files,
    count: files.length,
    size: files.reduce((total, file) => total + (Number(file.size) || 0), 0),
  };
}

function isLargeSelection({ count, size }) {
  return count > LARGE_SELECTION_COUNT || size > LARGE_SELECTION_BYTES;
}

function previewFolderFromForm(form) {
  const number = normalizeChapterNumber(form.number?.value || "");
  const imagesRoot = String(form.imagesRoot?.value || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot;
  return buildGithubImageFolder({
    imagesRoot,
    jsonFileName: getJsonFileName(),
    chapterNumber: number || getNextChapterNumber(),
  });
}

function updateDestinationPreview(form) {
  const preview = form.querySelector("[data-github-upload-destination]");
  if (!preview) return;
  preview.textContent = previewFolderFromForm(form);
}

function updateSelectionPreview(form) {
  const preview = form.querySelector("[data-github-upload-selection]");
  if (!preview) return;
  const stats = selectedImageStats(form);

  if (!stats.count) {
    preview.textContent = copy.selectionEmpty();
    preview.classList.remove("warning");
    return;
  }

  const ordered = filterImageFiles(stats.files);
  const names = ordered.slice(0, 5).map((file) => file.name).join(" → ");
  const remaining = Math.max(0, ordered.length - 5);
  preview.textContent = `${copy.selectionSummary(stats.count, formatBytes(stats.size))}\n${copy.selectionOrder(names, remaining)}`;
  preview.classList.toggle("warning", isLargeSelection(stats));
}

function updatePagesWarning(form) {
  const warning = form.querySelector("[data-github-pages-warning]");
  if (!warning) return;
  warning.hidden = form.linkMode?.value !== "pages";
}

function setProgress(modal, { done, total, text }) {
  const status = modal.querySelector("[data-github-upload-status]");
  const bar = modal.querySelector("[data-github-upload-bar]");
  const progress = total ? Math.round((done / total) * 100) : 0;
  if (status) status.textContent = text || copy.preparing();
  if (bar) bar.style.setProperty("--progress", `${progress}%`);
}

function addSummaryLine(modal, className, text) {
  const summary = modal.querySelector("[data-github-upload-summary]");
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
  const number = normalizeChapterNumber(formData.get("number") || "");
  const qualityPercent = Number(formData.get("quality") || 85);
  const quality = Math.min(1, Math.max(0.1, qualityPercent / 100));
  const maxWidth = Math.max(100, Number(formData.get("maxWidth") || imageProcessingDefaults.maxWidth));

  return {
    number,
    title: String(formData.get("title") || "").trim(),
    volume: String(formData.get("volume") || "").trim(),
    groupName: String(formData.get("groupName") || "").trim(),
    imagesRoot: String(formData.get("imagesRoot") || githubImageDefaults.imagesRoot).trim() || githubImageDefaults.imagesRoot,
    conflictMode: String(formData.get("conflictMode") || "cancel"),
    linkMode: String(formData.get("linkMode") || githubImageDefaults.linkMode),
    maxWidth,
    quality,
    files: Array.from(form.querySelector("input[name='images']")?.files || []),
  };
}

function resolveExistingChapter({ number, conflictMode }) {
  const chapters = state.current?.data?.chapters || {};
  const exists = Object.prototype.hasOwnProperty.call(chapters, number);

  if (!exists) return { exists, shouldContinue: true };
  if (conflictMode === "cancel") return { exists, shouldContinue: false };

  return { exists, shouldContinue: true };
}

function confirmExistingChapterAction(settings) {
  const exists = Object.prototype.hasOwnProperty.call(state.current?.data?.chapters || {}, settings.number);
  if (!exists) return true;

  if (settings.conflictMode === "replace") {
    return confirm(copy.confirmChapterReplace(settings.number));
  }

  if (settings.conflictMode === "merge") {
    return confirm(copy.confirmChapterMerge(settings.number, settings.groupName));
  }

  return false;
}

async function getExistingFileSha(client, path) {
  try {
    const file = await client.listContents({
      ...state.config,
      path,
    });

    if (Array.isArray(file) || file?.type !== "file") return null;
    return file.sha || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function buildPredictedUploadItems(settings) {
  const images = filterImageFiles(settings.files);
  const total = images.length;
  const jsonFileName = getJsonFileName();

  return images.map((file, index) => {
    const fileName = formatOutputFileName(index, total);
    return {
      file,
      fileName,
      path: buildGithubImagePath({
        imagesRoot: settings.imagesRoot,
        jsonFileName,
        chapterNumber: settings.number,
        fileName,
      }),
    };
  });
}

async function precheckExistingFiles({ modal, client, settings }) {
  const predictedItems = buildPredictedUploadItems(settings);
  const total = predictedItems.length;

  for (let index = 0; index < predictedItems.length; index += 1) {
    const item = predictedItems[index];
    setProgress(modal, {
      done: index,
      total,
      text: copy.prechecking(index + 1, total, item.fileName),
    });
    item.sha = await getExistingFileSha(client, item.path);
  }

  return predictedItems.filter((item) => item.sha);
}

async function runUpload({ modal, form, onSave }) {
  const settings = collectSettings(form);
  const stats = selectedImageStats(form);
  savePreferences(form);

  if (!settings.number || !isValidChapterNumber(settings.number)) {
    toast(copy.invalidChapter(), "error");
    return;
  }

  if (!settings.files.length) {
    toast(copy.selectImages(), "error");
    return;
  }

  if (isLargeSelection(stats)) {
    const ok = confirm(copy.confirmLargeSelection(stats.count, formatBytes(stats.size)));
    if (!ok) return;
  }

  const conflict = resolveExistingChapter({
    number: settings.number,
    conflictMode: settings.conflictMode,
  });

  if (!conflict.shouldContinue) {
    toast(copy.chapterExists(settings.number), "error");
    return;
  }

  if (!confirmExistingChapterAction(settings)) return;

  const progress = modal.querySelector("[data-github-upload-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: settings.files.length, text: copy.preparing() });

  try {
    const client = ensureClient();
    const existingBeforeProcessing = await precheckExistingFiles({ modal, client, settings });

    if (existingBeforeProcessing.length) {
      addSummaryLine(modal, "skip", copy.existingFilesFound(existingBeforeProcessing.length));
      const ok = confirm(copy.confirmOverwriteFiles(existingBeforeProcessing.length));
      if (!ok) return;
    } else {
      addSummaryLine(modal, "ok", copy.noExistingFiles());
    }

    const processed = await processImageFiles(settings.files, {
      maxWidth: settings.maxWidth,
      quality: settings.quality,
      onProgress: ({ index, total, file }) => {
        setProgress(modal, {
          done: index,
          total: total * 3,
          text: copy.processing(index + 1, total, file.name),
        });
      },
    });

    const jsonFileName = getJsonFileName();
    const folder = buildGithubImageFolder({
      imagesRoot: settings.imagesRoot,
      jsonFileName,
      chapterNumber: settings.number,
    });

    const items = buildGithubImageUploadItems({
      config: state.config,
      jsonFileName,
      chapterNumber: settings.number,
      images: processed,
      imagesRoot: settings.imagesRoot,
      linkMode: settings.linkMode,
    });

    addSummaryLine(modal, "skip", `${copy.destination()}: ${folder}`);

    const total = items.length;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setProgress(modal, {
        done: total + index,
        total: total * 3,
        text: copy.checking(index + 1, total, item.fileName),
      });

      item.sha = await getExistingFileSha(client, item.path);
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setProgress(modal, {
        done: total * 2 + index,
        total: total * 3,
        text: copy.uploading(index + 1, total, item.fileName),
      });

      await client.putBase64File({
        ...state.config,
        path: item.path,
        base64Content: item.base64DataUrl,
        message: `${item.sha ? "Update" : "Upload"} ${item.path} via Adder Pages`,
        sha: item.sha,
      });

      addSummaryLine(modal, "ok", item.sha ? copy.overwrittenLine(item.fileName, formatBytes(item.size)) : copy.uploadedLine(item.fileName, formatBytes(item.size)));
    }

    const urls = items.map((item) => item.url);
    const chapter = {
      title: settings.title,
      volume: settings.volume,
      last_updated: String(Math.floor(Date.now() / 1000)),
      groups: {
        [settings.groupName]: urls,
      },
    };

    addSummaryLine(modal, "ok", `${copy.originalSize()}: ${formatBytes(sumBytes(processed, "originalSize"))}`);
    addSummaryLine(modal, "ok", `${copy.finalSize()}: ${formatBytes(sumBytes(processed, "size"))}`);

    onSave({
      number: settings.number,
      chapter,
      conflictMode: settings.conflictMode,
      folder,
      items,
    });

    setProgress(modal, { done: total * 3, total: total * 3, text: copy.done(items.length) });
    toast(copy.done(items.length), "success");
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    setBusy(false);
    disableForm(form, false);
    updateDestinationPreview(form);
    updateSelectionPreview(form);
  }
}

export function showGithubImageUploadModal({ onSave }) {
  const nextNumber = getNextChapterNumber();
  const preferences = loadPreferences();
  const imagesRoot = preferences.imagesRoot || githubImageDefaults.imagesRoot;
  const maxWidth = preferences.maxWidth || imageProcessingDefaults.maxWidth;
  const quality = preferences.quality || 85;
  const linkMode = preferences.linkMode || githubImageDefaults.linkMode;
  const conflictMode = preferences.conflictMode || "cancel";
  const initialDestination = buildGithubImageFolder({
    imagesRoot,
    jsonFileName: getJsonFileName(),
    chapterNumber: nextNumber,
  });
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

      <form id="github-image-upload-form" class="drawer-form multi-chapter-form" autocomplete="off">
        <div class="multi-chapter-scroll-area">
          <div class="drawer-grid chapter-meta-grid">
            <label class="field">
              <span>${copy.chapterNumber()}</span>
              <input name="number" value="${attr(nextNumber)}" placeholder="85" required />
            </label>
            <label class="field">
              <span>${copy.volume()}</span>
              <input name="volume" placeholder="${attr(t("volumePlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.group()}</span>
              <input name="groupName" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.imagesRoot()}</span>
              <input name="imagesRoot" value="${attr(imagesRoot)}" />
            </label>
          </div>

          <div class="notice">
            <strong>${copy.destination()}</strong>
            <code data-github-upload-destination>${attr(initialDestination)}</code>
            <p class="hint">${copy.destinationHint()}</p>
          </div>

          <label class="field">
            <span>${copy.chapterTitle()}</span>
            <input name="title" placeholder="${attr(t("chapterTitlePlaceholder"))}" />
          </label>

          <div class="drawer-grid">
            <label class="field">
              <span>${copy.maxWidth()}</span>
              <input name="maxWidth" type="number" min="100" step="50" value="${attr(maxWidth)}" />
            </label>
            <label class="field">
              <span>${copy.quality()}</span>
              <input name="quality" type="number" min="10" max="100" step="1" value="${attr(quality)}" />
            </label>
          </div>

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
                <option value="replace" ${conflictMode === "replace" ? "selected" : ""}>${copy.conflictReplace()}</option>
                <option value="merge" ${conflictMode === "merge" ? "selected" : ""}>${copy.conflictMerge()}</option>
              </select>
            </label>
          </div>
          <p class="hint">${copy.preferencesHint()}</p>
          <p class="hint" data-github-pages-warning hidden>${copy.pagesWarning()}</p>

          <label class="field">
            <span>${copy.fileInput()}</span>
            <input name="images" type="file" accept="image/*" multiple required />
            <p class="hint">${copy.fileInputHint()}</p>
          </label>

          <div class="notice">
            <strong data-github-upload-selection>${copy.selectionEmpty()}</strong>
            <p class="hint">${copy.selectionWarning()}</p>
          </div>

          <section class="multi-chapter-progress" data-github-upload-progress hidden>
            <div class="multi-chapter-progress-head">
              <div class="multi-chapter-spinner" aria-hidden="true"></div>
              <div>
                <h3>${copy.summary()}</h3>
                <p data-github-upload-status>${copy.preparing()}</p>
              </div>
            </div>
            <div class="multi-chapter-bar" aria-hidden="true"><span data-github-upload-bar></span></div>
            <div class="multi-chapter-summary" data-github-upload-summary></div>
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
  const form = modal.querySelector("#github-image-upload-form");
  const close = () => modal.remove();
  const saveAndPreview = () => {
    savePreferences(form);
    updateDestinationPreview(form);
  };

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.number?.addEventListener("input", () => updateDestinationPreview(form));
  form.number?.addEventListener("blur", () => {
    form.number.value = normalizeChapterNumber(form.number.value);
    updateDestinationPreview(form);
  });
  form.imagesRoot?.addEventListener("input", saveAndPreview);
  form.maxWidth?.addEventListener("input", () => savePreferences(form));
  form.quality?.addEventListener("input", () => savePreferences(form));
  form.linkMode?.addEventListener("change", () => {
    savePreferences(form);
    updatePagesWarning(form);
  });
  form.conflictMode?.addEventListener("change", () => savePreferences(form));
  form.images?.addEventListener("change", () => updateSelectionPreview(form));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runUpload({ modal, form, onSave });
  });

  updateDestinationPreview(form);
  updateSelectionPreview(form);
  updatePagesWarning(form);
  form.number?.focus();
}

export function githubImageUploadButtonLabel() {
  return copy.button();
}
