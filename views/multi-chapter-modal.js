import { state, getSavedImgChestToken } from "../state.js";
import { attr } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbum } from "../imgchest.js";
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
  albumUrlsHint: () => label("Cada link importado vira um novo capítulo.", "Each imported link becomes a new chapter."),
  numbering: () => label("Numeração", "Numbering"),
  continueMode: () => label("Continuar do último capítulo", "Continue from latest chapter"),
  continueModeHint: (number) => label(`O primeiro novo capítulo será ${number}.`, `The first new chapter will be ${number}.`),
  manualMode: () => label("Começar em um número específico", "Start from a specific number"),
  manualModeHint: () => label("Use isto para preencher capítulos antigos, como 1 até 52.", "Use this to fill older chapters, such as 1 through 52."),
  startNumber: () => label("Começar em", "Start at"),
  increment: () => label("Incremento", "Increment"),
  titleTemplate: () => label("Título automático", "Automatic title"),
  titleTemplatePlaceholder: () => label("opcional, ex: Capítulo {n}", "optional, e.g. Chapter {n}"),
  conflictMode: () => label("Se o capítulo já existir", "If the chapter already exists"),
  conflictCancel: () => label("Cancelar importação", "Cancel import"),
  conflictSkip: () => label("Pular existentes", "Skip existing"),
  conflictReplace: () => label("Substituir existentes", "Replace existing"),
  conflictHint: () => label("O padrão é cancelar para evitar sobrescrever capítulos por engano.", "The default is cancel to avoid overwriting chapters by mistake."),
  importingTitle: () => label("Importando capítulos...", "Importing chapters..."),
  preparing: () => label("Preparando importação.", "Preparing import."),
  startImport: () => label("Importar capítulos", "Import chapters"),
  pasteLinksFirst: () => label("Cole pelo menos um link ImgChest.", "Paste at least one ImgChest link."),
  invalidStartNumber: () => label("Informe um número inicial válido.", "Enter a valid start number."),
  invalidIncrement: () => label("O incremento precisa ser maior que zero.", "The increment must be greater than zero."),
  conflictCancelToast: (numbers) => label(`Conflito: os capítulos ${numbers} já existem.`, `Conflict: chapters ${numbers} already exist.`),
  replaceConfirm: (numbers) => label(`Os capítulos ${numbers} já existem. Substituir esses capítulos?`, `Chapters ${numbers} already exist. Replace them?`),
  progress: (current, total, number) => label(`Importando ${current}/${total} — capítulo ${number}`, `Importing ${current}/${total} — chapter ${number}`),
  skippedLine: (number) => label(`Capítulo ${number} pulado porque já existe.`, `Chapter ${number} skipped because it already exists.`),
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

function formatChapterNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function buildPlan({ chapters, urls, mode, startNumber, increment, conflictMode }) {
  const existing = chapters || {};
  const base = mode === "manual" ? Number(startNumber) : getHighestNumericChapter(existing) + Number(increment);
  const step = Number(increment);
  const plan = [];
  const conflicts = [];

  urls.forEach((albumUrl, index) => {
    const number = formatChapterNumber(base + index * step);
    const exists = Object.prototype.hasOwnProperty.call(existing, number);
    if (exists) conflicts.push(number);
    plan.push({ albumUrl, number, exists, action: exists ? conflictMode : "create" });
  });

  return { plan, conflicts };
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
  startInput.disabled = selectedNumberingMode(form) !== "manual";
}

async function runImport({ modal, form, onSave }) {
  const formData = new FormData(form);
  const urls = uniqueLines(formData.get("albumUrls"));
  const mode = selectedNumberingMode(form);
  const startNumber = Number(formData.get("startNumber"));
  const increment = Number(formData.get("increment") || 1);
  const conflictMode = String(formData.get("conflictMode") || "cancel");
  const groupName = String(formData.get("groupName") || "").trim();
  const titleTemplate = String(formData.get("titleTemplate") || "").trim();

  if (!urls.length) {
    toast(copy.pasteLinksFirst(), "error");
    return;
  }

  if (mode === "manual" && !Number.isFinite(startNumber)) {
    toast(copy.invalidStartNumber(), "error");
    return;
  }

  if (!Number.isFinite(increment) || increment <= 0) {
    toast(copy.invalidIncrement(), "error");
    return;
  }

  const chapters = state.current?.data?.chapters || {};
  const { plan, conflicts } = buildPlan({ chapters, urls, mode, startNumber, increment, conflictMode });

  if (conflicts.length && conflictMode === "cancel") {
    toast(copy.conflictCancelToast(conflicts.join(", ")), "error");
    return;
  }

  if (conflicts.length && conflictMode === "replace") {
    const ok = confirm(copy.replaceConfirm(conflicts.join(", ")));
    if (!ok) return;
  }

  const progress = modal.querySelector("[data-multi-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: plan.length, text: copy.preparing() });

  const token = state.config?.imgchestToken || getSavedImgChestToken();
  const imported = [];
  const failed = [];
  const skipped = [];

  try {
    for (let index = 0; index < plan.length; index += 1) {
      const item = plan[index];
      const current = index + 1;

      if (item.exists && item.action === "skip") {
        skipped.push(item);
        addSummaryLine(modal, "skip", copy.skippedLine(item.number));
        setProgress(modal, { done: current, total: plan.length, text: copy.progress(current, plan.length, item.number) });
        continue;
      }

      setProgress(modal, { done: index, total: plan.length, text: copy.progress(current, plan.length, item.number) });

      try {
        const images = await scrapeImgChestAlbum(item.albumUrl, { token });
        const title = titleTemplate ? titleTemplate.replaceAll("{n}", item.number) : "";
        imported.push({
          number: item.number,
          chapter: {
            title,
            volume: "",
            last_updated: String(Math.floor(Date.now() / 1000)),
            groups: {
              [groupName]: images,
            },
          },
        });
        addSummaryLine(modal, "ok", copy.importedLine(item.number, images.length));
      } catch (error) {
        failed.push({ ...item, error });
        addSummaryLine(modal, "fail", copy.failedLine(item.number, error.message || String(error)));
      }

      setProgress(modal, { done: current, total: plan.length, text: copy.progress(current, plan.length, item.number) });
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
  const nextNumber = getHighestNumericChapter(state.current?.data?.chapters || {}) + 1;
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

      <form id="multi-chapter-form" class="drawer-form" autocomplete="off">
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

        <div class="drawer-grid">
          <label class="field">
            <span>${copy.startNumber()}</span>
            <input name="startNumber" type="number" step="0.001" value="${attr(formatChapterNumber(nextNumber))}" />
          </label>
          <label class="field">
            <span>${copy.increment()}</span>
            <input name="increment" type="number" step="0.001" min="0.001" value="1" />
          </label>
        </div>

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

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${copy.startImport()}</button>
          <button class="btn ghost" type="button" data-close-modal>${t("cancel")}</button>
        </div>
      </form>
    </aside>
  `;

  document.body.appendChild(modal);
  const form = modal.querySelector("#multi-chapter-form");
  const close = () => modal.remove();

  modal.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", close));
  form.querySelectorAll("input[name='numberingMode']").forEach((input) => input.addEventListener("change", () => updateManualStartState(form)));
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
