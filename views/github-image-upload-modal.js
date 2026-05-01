import { state } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { t } from "../i18n.js";
import { ensureClient } from "../repo.js";
import { processImageFiles, sumBytes, formatBytes, imageProcessingDefaults } from "../image-processing.js";
import { buildGithubImageUploadItems, buildGithubImageFolder, githubImageDefaults } from "../github-image-links.js";
import { normalizeChapterNumber, isValidChapterNumber } from "../chapter-number.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
  fileInput: () => label("Imagens", "Images"),
  fileInputHint: () => label("Selecione as páginas do capítulo. O Adder ordena por nome e renomeia como 001.jpg, 002.jpg...", "Select the chapter pages. Adder sorts by name and renames them as 001.jpg, 002.jpg..."),
  conflictMode: () => label("Se o capítulo já existir no JSON", "If the chapter already exists in the JSON"),
  conflictCancel: () => label("Cancelar", "Cancel"),
  conflictReplace: () => label("Substituir capítulo", "Replace chapter"),
  conflictMerge: () => label("Substituir imagens do grupo", "Replace group images"),
  startUpload: () => label("Processar e enviar", "Process and upload"),
  close: () => t("close") || label("Fechar", "Close"),
  cancel: () => t("cancel") || label("Cancelar", "Cancel"),
  invalidChapter: () => label("Informe um número de capítulo válido. Exemplos: 85, 85.5, 10.2.", "Enter a valid chapter number. Examples: 85, 85.5, 10.2."),
  selectImages: () => label("Selecione pelo menos uma imagem.", "Select at least one image."),
  chapterExists: (number) => label(`O capítulo ${number} já existe.`, `Chapter ${number} already exists.`),
  preparing: () => label("Preparando imagens...", "Preparing images..."),
  processing: (current, total, name) => label(`Processando ${current}/${total} — ${name}`, `Processing ${current}/${total} — ${name}`),
  uploading: (current, total, name) => label(`Enviando ${current}/${total} — ${name}`, `Uploading ${current}/${total} — ${name}`),
  uploadedLine: (name, size) => label(`${name} enviado (${size}).`, `${name} uploaded (${size}).`),
  done: (count) => label(`${count} imagens enviadas. Clique em Salvar no GitHub para gravar o JSON.`, `${count} images uploaded. Click Save to GitHub to write the JSON.`),
  destination: () => label("Destino", "Destination"),
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

async function runUpload({ modal, form, onSave }) {
  const settings = collectSettings(form);

  if (!settings.number || !isValidChapterNumber(settings.number)) {
    toast(copy.invalidChapter(), "error");
    return;
  }

  if (!settings.files.length) {
    toast(copy.selectImages(), "error");
    return;
  }

  const conflict = resolveExistingChapter({
    number: settings.number,
    conflictMode: settings.conflictMode,
  });

  if (!conflict.shouldContinue) {
    toast(copy.chapterExists(settings.number), "error");
    return;
  }

  const progress = modal.querySelector("[data-github-upload-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: settings.files.length * 2, text: copy.preparing() });

  try {
    const processed = await processImageFiles(settings.files, {
      maxWidth: settings.maxWidth,
      quality: settings.quality,
      onProgress: ({ index, total, file }) => {
        setProgress(modal, {
          done: index,
          total: total * 2,
          text: copy.processing(index + 1, total, file.name),
        });
      },
    });

    const jsonFileName = state.current?.name || "manga.json";
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

    const client = ensureClient();
    const total = items.length;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setProgress(modal, {
        done: total + index,
        total: total * 2,
        text: copy.uploading(index + 1, total, item.fileName),
      });

      await client.putBase64File({
        ...state.config,
        path: item.path,
        base64Content: item.base64DataUrl,
        message: `Upload ${item.path} via Adder Pages`,
      });

      addSummaryLine(modal, "ok", copy.uploadedLine(item.fileName, formatBytes(item.size)));
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

    setProgress(modal, { done: total * 2, total: total * 2, text: copy.done(items.length) });
    toast(copy.done(items.length), "success");
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    setBusy(false);
    disableForm(form, false);
  }
}

export function showGithubImageUploadModal({ onSave }) {
  const nextNumber = getNextChapterNumber();
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
              <input name="imagesRoot" value="${attr(githubImageDefaults.imagesRoot)}" />
            </label>
          </div>

          <label class="field">
            <span>${copy.chapterTitle()}</span>
            <input name="title" placeholder="${attr(t("chapterTitlePlaceholder"))}" />
          </label>

          <div class="drawer-grid">
            <label class="field">
              <span>${copy.maxWidth()}</span>
              <input name="maxWidth" type="number" min="100" step="50" value="${attr(imageProcessingDefaults.maxWidth)}" />
            </label>
            <label class="field">
              <span>${copy.quality()}</span>
              <input name="quality" type="number" min="10" max="100" step="1" value="85" />
            </label>
          </div>

          <div class="drawer-grid">
            <label class="field">
              <span>${copy.linkMode()}</span>
              <select name="linkMode">
                <option value="raw" selected>${copy.rawMode()}</option>
                <option value="pages">${copy.pagesMode()}</option>
              </select>
            </label>
            <label class="field">
              <span>${copy.conflictMode()}</span>
              <select name="conflictMode">
                <option value="cancel" selected>${copy.conflictCancel()}</option>
                <option value="replace">${copy.conflictReplace()}</option>
                <option value="merge">${copy.conflictMerge()}</option>
              </select>
            </label>
          </div>

          <label class="field">
            <span>${copy.fileInput()}</span>
            <input name="images" type="file" accept="image/*" multiple required />
            <p class="hint">${copy.fileInputHint()}</p>
          </label>

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

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.number?.addEventListener("blur", () => {
    form.number.value = normalizeChapterNumber(form.number.value);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runUpload({ modal, form, onSave });
  });

  form.number?.focus();
}

export function githubImageUploadButtonLabel() {
  return copy.button();
}
