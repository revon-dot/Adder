import { state, getSavedImgChestToken } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbumDetails } from "../imgchest.js";
import { addToChapterNumber, extractChapterNumberFromTitle, isValidChapterNumber, normalizeChapterNumber } from "../chapter-number.js";
import { t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

const copy = {
  button: () => label("Upload múltiplo ImgChest", "Multi ImgChest upload"),
  kicker: () => label("Importação em lote", "Batch import"),
  title: () => label("Adicionar vários capítulos", "Add multiple chapters"),
  albumUrls: () => label("Links dos álbuns ImgChest", "ImgChest album links"),
  albumUrlsPlaceholder: () => label("Cole um link ImgChest por linha", "Paste one ImgChest link per line"),
  albumUrlsHint: () => label("Se o álbum tiver título, o Adder tenta detectar o número do capítulo automaticamente. Se não tiver, usa a sequência abaixo.", "If the album has a title, Adder tries to detect the chapter number automatically. If not, it uses the sequence below."),
  numbering: () => label("Numeração de fallback", "Fallback numbering"),
  continueMode: () => label("Continuar do último capítulo", "Continue from latest chapter"),
  continueModeHint: (number) => label(`O primeiro capítulo sem número detectado será ${number}.`, `The first chapter without a detected number will be ${number}.`),
  manualMode: () => label("Começar em um número específico", "Start from a specific number"),
  manualModeHint: () => label("Usado só quando o título do álbum não tiver número detectável.", "Used only when the album title has no detectable number."),
  startNumber: () => label("Começar em", "Start at"),
  titleTemplate: () => label("Título automático", "Automatic title"),
  titleTemplatePlaceholder: () => label("opcional, ex: Capítulo {n}", "optional, e.g. Chapter {n}"),
  conflictMode: () => label("Se o capítulo já existir", "If the chapter already exists"),
  conflictCancel: () => label("Cancelar importação", "Cancel import"),
  conflictSkip: () => label("Pular existentes", "Skip existing"),
  conflictReplace: () => label("Substituir existentes", "Replace existing"),
  conflictHint: () => label("O padrão é cancelar para evitar sobrescrever capítulos por engano.", "The default is cancel to avoid overwriting chapters by mistake."),
  importingTitle: () => label("Importando capítulos...", "Importing chapters..."),
  preparing: () => label("Preparando importação.", "Preparing import."),
  startImport: () => label("Importar Capítulos", "Import Chapters"),
  cancel: () => label("Cancelar", "Cancel"),
  pasteLinksFirst: () => label("Cole pelo menos um link ImgChest.", "Paste at least one ImgChest link."),
  invalidStartNumber: () => label("Informe um número inicial válido. Exemplos: 97, 97.5, 10.2.", "Enter a valid start number. Examples: 97, 97.5, 10.2."),
  conflictCancelToast: (numbers) => label(`Conflito: os capítulos ${numbers} já existem.`, `Conflict: chapters ${numbers} already exist.`),
  replaceConfirm: (numbers) => label(`Os capítulos ${numbers} já existem. Substituir esses capítulos?`, `Chapters ${numbers} already exist. Replace them?`),
  progress: (current, total, number) => label(`Importando ${current}/${total} — capítulo ${number}`, `Importing ${current}/${total} — chapter ${number}`),
  skippedLine: (number) => label(`Capítulo ${number} pulado porque já existe.`, `Chapter ${number} skipped because it already exists.`),
  detectedLine: (title, number) => label(`Título "${title}" → capítulo ${number}.`, `Title "${title}" → chapter ${number}.`),
  fallbackLine: (number) => label(`Sem número detectado no título. Usando fallback: capítulo ${number}.`, `No number detected in title. Using fallback: chapter ${number}.`),
  importedLine: (number, count) => label(`Capítulo ${number}: ${count} imagens importadas.`, `Chapter ${number}: ${count} images imported.`),
  failedLine: (number, message) => label(`Capítulo ${number}: falhou — ${message}`, `Chapter ${number}: failed — ${message}`),
  nothingImported: () => label("Nenhum capítulo foi importado.", "No chapters were imported."),
  partialConfirm: (imported, failed) => label(`${imported} capítulos importados e ${failed} falharam. Manter os importados?`, `${imported} chapters imported and ${failed} failed. Keep the imported chapters?`),
  done: (count) => label(`${count} capítulos importados. Clique em Salvar no GitHub para gravar o JSON.`, `${count} chapters imported. Click Save to GitHub to write the JSON.`),
};

function uniqueLines(text = "") {
  const seen = new Set();
  const values = [];

  String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      if (seen.has(line)) return;
      seen.add(line);
      values.push(line);
    });

  return values;
}

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

function formatChapterNumber(value) {
  return normalizeChapterNumber(value);
}

function fallbackNumber(base, index) {
  return addToChapterNumber(base, index);
}

function setProgress(modal, { done, total, text }) {
  const status = modal.querySelector("[data-multi-status]");
  const bar = modal.querySelector("[data-multi-bar]");
  const progress = total ? Math.round((done / total) * 100) : 0;
  if (status) status.textContent = text || copy.preparing();
  if (bar) bar.style.setProperty("--progress", `${progress}%`);
}

function addSummaryLine(modal, className, text) {
  const summary = modal.querySelector("[data-multi-summary]");
  if (!summary) return;
  const line = document.createElement("div");
  line.className = className;
  line.textContent = text;
  summary.appendChild(line);
  summary.scrollTop = summary.scrollHeight;
}

function disableForm(form, disabled) {
  form.querySelectorAll("input, textarea, select, button").forEach((element) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement) {
      element.disabled = disabled;
    }
  });
}

function selectedNumberingMode(form) {
  return form.querySelector("input[name='numberingMode']:checked")?.value || "continue";
}

function updateManualStartState(form) {
  const startInput = form.querySelector("input[name='startNumber']");
  if (!startInput) return;

  const isManual = selectedNumberingMode(form) === "manual";
  if (!isManual) {
    startInput.value = formatChapterNumber(getNextChapterNumber());
  } else {
    startInput.value = formatChapterNumber(startInput.value);
  }
  startInput.disabled = !isManual;
  startInput.setAttribute("aria-disabled", String(!isManual));
}

function resolveConflict({ existing, number, conflictMode }) {
  const exists = Object.prototype.hasOwnProperty.call(existing, number);
  return {
    exists,
    action: exists ? conflictMode : "create",
  };
}

async function runImport({ modal, form, onSave }) {
  updateManualStartState(form);
  const formData = new FormData(form);
  const urls = uniqueLines(formData.get("albumUrls"));
  const mode = selectedNumberingMode(form);
  const startNumber = formatChapterNumber(formData.get("startNumber"));
  const conflictMode = String(formData.get("conflictMode") || "cancel");
  const groupName = String(formData.get("groupName") || "").trim();
  const titleTemplate = String(formData.get("titleTemplate") || "").trim();

  if (!urls.length) {
    toast(copy.pasteLinksFirst(), "error");
    return;
  }

  if (mode === "manual" && (!isValidChapterNumber(startNumber) || Number.parseFloat(startNumber) < 1)) {
    toast(copy.invalidStartNumber(), "error");
    return;
  }

  const existing = state.current?.data?.chapters || {};
  const base = mode === "manual" ? startNumber : getNextChapterNumber();

  const progress = modal.querySelector("[data-multi-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: urls.length, text: copy.preparing() });

  const token = state.config?.imgchestToken || getSavedImgChestToken();
  const imported = [];
  const failed = [];
  const skipped = [];
  let fallbackIndex = 0;

  try {
    for (let index = 0; index < urls.length; index += 1) {
      const albumUrl = urls[index];
      const current = index + 1;
      let number = fallbackNumber(base, fallbackIndex);

      setProgress(modal, { done: index, total: urls.length, text: copy.progress(current, urls.length, number) });

      try {
        const details = await scrapeImgChestAlbumDetails(albumUrl, { token });
        const detectedNumber = extractChapterNumberFromTitle(details.title);

        if (detectedNumber) {
          number = detectedNumber;
          addSummaryLine(modal, "ok", copy.detectedLine(details.title, number));
        } else {
          fallbackIndex += 1;
          addSummaryLine(modal, "skip", copy.fallbackLine(number));
        }

        const conflict = resolveConflict({ existing, number, conflictMode });

        if (conflict.exists && conflict.action === "cancel") {
          throw new Error(copy.conflictCancelToast(number));
        }

        if (conflict.exists && conflict.action === "replace") {
          const ok = confirm(copy.replaceConfirm(number));
          if (!ok) {
            skipped.push({ albumUrl, number, exists: true, action: "skip" });
            addSummaryLine(modal, "skip", copy.skippedLine(number));
            continue;
          }
        }

        if (conflict.exists && conflict.action === "skip") {
          skipped.push({ albumUrl, number, exists: true, action: "skip" });
          addSummaryLine(modal, "skip", copy.skippedLine(number));
          continue;
        }

        const title = titleTemplate ? titleTemplate.replaceAll("{n}", number) : "";
        imported.push({
          number,
          chapter: {
            title,
            volume: "",
            last_updated: String(Math.floor(Date.now() / 1000)),
            groups: {
              [groupName]: details.images,
            },
          },
        });
        addSummaryLine(modal, "ok", copy.importedLine(number, details.images.length));
      } catch (error) {
        failed.push({ albumUrl, number, error });
        addSummaryLine(modal, "fail", copy.failedLine(number, error.message || String(error)));
      }

      setProgress(modal, { done: current, total: urls.length, text: copy.progress(current, urls.length, number) });
    }

    if (!imported.length) {
      toast(copy.nothingImported(), "error");
      return;
    }

    if (failed.length) {
      const ok = confirm(copy.partialConfirm(imported.length, failed.length));
      if (!ok) return;
    }

    onSave({ imported, failed, skipped });
    toast(copy.done(imported.length), "success");
    modal.remove();
  } finally {
    setBusy(false);
    disableForm(form, false);
    updateManualStartState(form);
  }
}

export function showMultiChapterUploadModal({ onSave }) {
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
        <button class="btn ghost small" type="button" data-close-modal>${t("close")}</button>
      </div>

      <form id="multi-chapter-form" class="drawer-form multi-chapter-form" autocomplete="off">
        <div class="multi-chapter-scroll-area">
          <label class="field">
            <span>${copy.albumUrls()}</span>
            <textarea class="multi-chapter-textarea" name="albumUrls" placeholder="${attr(copy.albumUrlsPlaceholder())}" required></textarea>
            <p class="hint">${copy.albumUrlsHint()}</p>
          </label>

          <div class="drawer-section-title">
            <strong>${copy.numbering()}</strong>
          </div>

          <div class="multi-chapter-options">
            <label class="multi-chapter-option">
              <input type="radio" name="numberingMode" value="continue" checked />
              <span>
                <strong>${copy.continueMode()}</strong>
                <span>${copy.continueModeHint(formatChapterNumber(nextNumber))}</span>
              </span>
            </label>
            <label class="multi-chapter-option">
              <input type="radio" name="numberingMode" value="manual" />
              <span>
                <strong>${copy.manualMode()}</strong>
                <span>${copy.manualModeHint()}</span>
              </span>
            </label>
          </div>

          <label class="field">
            <span>${copy.startNumber()}</span>
            <input name="startNumber" type="text" inputmode="decimal" pattern="\\d+(\\.\\d+)?" value="${attr(formatChapterNumber(nextNumber))}" />
          </label>

          <div class="drawer-grid">
            <label class="field">
              <span>${t("group")}</span>
              <input name="groupName" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
            </label>
            <label class="field">
              <span>${copy.titleTemplate()}</span>
              <input name="titleTemplate" placeholder="${attr(copy.titleTemplatePlaceholder())}" />
            </label>
          </div>

          <label class="field">
            <span>${copy.conflictMode()}</span>
            <select name="conflictMode">
              <option value="cancel">${copy.conflictCancel()}</option>
              <option value="skip">${copy.conflictSkip()}</option>
              <option value="replace">${copy.conflictReplace()}</option>
            </select>
            <p class="hint">${copy.conflictHint()}</p>
          </label>

          <section class="multi-chapter-progress" data-multi-progress hidden>
            <div class="multi-chapter-progress-head">
              <div class="multi-chapter-spinner" aria-hidden="true"></div>
              <div>
                <h3>${copy.importingTitle()}</h3>
                <p data-multi-status>${copy.preparing()}</p>
              </div>
            </div>
            <div class="multi-chapter-bar" aria-hidden="true"><span data-multi-bar></span></div>
            <div class="multi-chapter-summary" data-multi-summary></div>
          </section>
        </div>

        <div class="drawer-actions multi-chapter-actions">
          <button class="btn primary" type="submit">${copy.startImport()}</button>
          <button class="btn ghost" type="button" data-close-modal>${copy.cancel()}</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#multi-chapter-form");
  const close = () => modal.remove();

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.querySelectorAll("input[name='numberingMode']").forEach((input) => input.addEventListener("change", () => updateManualStartState(form)));
  form.querySelector("input[name='startNumber']")?.addEventListener("blur", () => updateManualStartState(form));
  updateManualStartState(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runImport({ modal, form, onSave });
  });

  form.albumUrls?.focus();
}

export function multiChapterUploadButtonLabel() {
  return copy.button();
}
