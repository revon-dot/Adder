import { state, getSavedImgChestToken } from "../state.js";
import { attr, escapeHtml } from "../utils.js";
import { toast, setBusy } from "../ui.js";
import { scrapeImgChestAlbum } from "../imgchest.js";
import { t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
  if (status) status.textContent = text || t("multiImportPreparing");
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
    toast(t("multiPasteLinksFirst"), "error");
    return;
  }

  if (mode === "manual" && !Number.isFinite(startNumber)) {
    toast(t("multiInvalidStartNumber"), "error");
    return;
  }

  if (!Number.isFinite(increment) || increment <= 0) {
    toast(t("multiInvalidIncrement"), "error");
    return;
  }

  const chapters = state.current?.data?.chapters || {};
  const { plan, conflicts } = buildPlan({ chapters, urls, mode, startNumber, increment, conflictMode });

  if (conflicts.length && conflictMode === "cancel") {
    toast(t("multiConflictCancelToast", { numbers: conflicts.join(", ") }), "error");
    return;
  }

  if (conflicts.length && conflictMode === "replace") {
    const ok = confirm(t("multiReplaceConfirm", { numbers: conflicts.join(", ") }));
    if (!ok) return;
  }

  const progress = modal.querySelector("[data-multi-progress]");
  if (progress) progress.hidden = false;
  disableForm(form, true);
  setBusy(true);
  setProgress(modal, { done: 0, total: plan.length, text: t("multiImportPreparing") });

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
        addSummaryLine(modal, "skip", t("multiSkippedLine", { number: item.number }));
        setProgress(modal, {
          done: current,
          total: plan.length,
          text: t("multiImportProgress", { current, total: plan.length, number: item.number }),
        });
        continue;
      }

      setProgress(modal, {
        done: index,
        total: plan.length,
        text: t("multiImportProgress", { current, total: plan.length, number: item.number }),
      });

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
        addSummaryLine(modal, "ok", t("multiImportedLine", { number: item.number, count: images.length }));
      } catch (error) {
        failed.push({ ...item, error });
        addSummaryLine(modal, "fail", t("multiFailedLine", { number: item.number, message: error.message || String(error) }));
      }

      setProgress(modal, {
        done: current,
        total: plan.length,
        text: t("multiImportProgress", { current, total: plan.length, number: item.number }),
      });
    }

    if (!imported.length) {
      toast(t("multiNothingImported"), "error");
      return;
    }

    if (failed.length) {
      const ok = confirm(t("multiPartialConfirm", { imported: imported.length, failed: failed.length }));
      if (!ok) return;
    }

    onSave({ imported, failed, skipped });
    toast(t("multiImportDone", { count: imported.length }), "success");
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
          <p class="kicker">${t("multiUploadKicker")}</p>
          <h2>${t("multiUploadTitle")}</h2>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>${t("close")}</button>
      </div>

      <form id="multi-chapter-form" class="drawer-form" autocomplete="off">
        <label class="field">
          <span>${t("multiAlbumUrls")}</span>
          <textarea class="multi-chapter-textarea" name="albumUrls" placeholder="${attr(t("multiAlbumUrlsPlaceholder"))}" required></textarea>
          <p class="hint">${t("multiAlbumUrlsHint")}</p>
        </label>

        <div class="drawer-section-title">
          <strong>${t("multiNumbering")}</strong>
        </div>

        <div class="multi-chapter-options">
          <label class="multi-chapter-option">
            <input type="radio" name="numberingMode" value="continue" checked />
            <span>
              <strong>${t("multiContinueMode")}</strong>
              <span>${t("multiContinueModeHint", { number: formatChapterNumber(nextNumber) })}</span>
            </span>
          </label>
          <label class="multi-chapter-option">
            <input type="radio" name="numberingMode" value="manual" />
            <span>
              <strong>${t("multiManualMode")}</strong>
              <span>${t("multiManualModeHint")}</span>
            </span>
          </label>
        </div>

        <div class="drawer-grid">
          <label class="field">
            <span>${t("multiStartNumber")}</span>
            <input name="startNumber" type="number" step="0.001" value="${attr(formatChapterNumber(nextNumber))}" />
          </label>
          <label class="field">
            <span>${t("multiIncrement")}</span>
            <input name="increment" type="number" step="0.001" min="0.001" value="1" />
          </label>
        </div>

        <div class="drawer-grid">
          <label class="field">
            <span>${t("group")}</span>
            <input name="groupName" placeholder="${attr(t("emptyGroupPlaceholder"))}" />
          </label>
          <label class="field">
            <span>${t("multiTitleTemplate")}</span>
            <input name="titleTemplate" placeholder="${attr(t("multiTitleTemplatePlaceholder"))}" />
          </label>
        </div>

        <label class="field">
          <span>${t("multiConflictMode")}</span>
          <select name="conflictMode">
            <option value="cancel">${t("multiConflictCancel")}</option>
            <option value="skip">${t("multiConflictSkip")}</option>
            <option value="replace">${t("multiConflictReplace")}</option>
          </select>
          <p class="hint">${t("multiConflictHint")}</p>
        </label>

        <section class="multi-chapter-progress" data-multi-progress hidden>
          <div class="multi-chapter-progress-head">
            <div class="multi-chapter-spinner" aria-hidden="true"></div>
            <div>
              <h3>${t("multiImportingTitle")}</h3>
              <p data-multi-status>${t("multiImportPreparing")}</p>
            </div>
          </div>
          <div class="multi-chapter-bar" aria-hidden="true"><span data-multi-bar></span></div>
          <div class="multi-chapter-summary" data-multi-summary></div>
        </section>

        <div class="drawer-actions">
          <button class="btn primary" type="submit">${t("multiStartImport")}</button>
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
