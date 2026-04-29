import { escapeHtml, attr } from "../utils.js";
import { repoLabel, cubariUrlForPath } from "../repo.js";
import { renderChapterCards } from "./editor-renderers.js";
import { renderLanguageToggle, t } from "../i18n.js";

function backIcon() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function renderSavedLinks(current) {
  if (current.isNew || !current.path) return "";
  const cubariUrl = cubariUrlForPath(current.path);
  const githubUrl = current.htmlUrl || "";
  return `
    <section class="notice editor-links editor-footer-links" id="saved-links-panel">
      <strong>${t("savedFile")}</strong>
      <span>${escapeHtml(current.path)}</span>
      <div class="row-actions">
        ${githubUrl ? `<a class="btn ghost small" href="${attr(githubUrl)}" target="_blank" rel="noreferrer">${t("openGithub")}</a>` : ""}
        ${cubariUrl ? `<button class="btn ghost small" type="button" id="copy-editor-cubari-btn" data-cubari-url="${attr(cubariUrl)}">${t("copyCubari")}</button>` : ""}
        ${current.downloadUrl ? `<button class="btn ghost small" type="button" id="copy-editor-raw-btn" data-raw-url="${attr(current.downloadUrl)}">${t("copyRaw")}</button>` : ""}
      </div>
    </section>
  `;
}

export function renderEditorPage(current, manifest) {
  const fileNameReadonly = current.isNew ? "readonly aria-readonly=\"true\"" : "";

  return `
    <header class="dashboard-header dashboard-compact editor-header">
      <div class="dashboard-main">
        <div class="dashboard-title-wrap">
          <button class="dashboard-logo logo-button back-logo-button" type="button" id="logo-dashboard-btn" aria-label="${t("back")}">${backIcon()}</button>
          <div>
            <p class="kicker">${t("editor")}</p>
            <h2>${escapeHtml(manifest.title || t("newManga"))}</h2>
          </div>
        </div>

        <div class="dashboard-status-row">
          <span class="status-pill"><span class="status-dot"></span>${escapeHtml(repoLabel())}</span>
          <span class="mini-stat"><strong id="stat-chapters">0</strong> ${t("chapters")}</span>
          <span class="mini-stat"><strong id="stat-groups">0</strong> ${t("groups")}</span>
          <span class="mini-stat"><strong id="stat-images">0</strong> ${t("images")}</span>
        </div>
      </div>

      <div class="toolbar dashboard-toolbar">
        <button class="btn primary" id="save-btn">${t("saveToGithub")}</button>
        ${renderLanguageToggle("editor-language")}
      </div>
    </header>
    
    <section class="panel editor-panel">
      <form id="editor-form" class="form-grid editor-form-block">
        <div class="field group editor-main-fields">
          <label class="field">
            <span>${t("fileName")}</span>
            <input name="fileName" value="${attr(current.name)}" placeholder="${attr(t("fileNamePlaceholder"))}" ${fileNameReadonly} />
            <p class="hint">${current.isNew ? t("fileNameAutoHint") : t("fileNameHint")}</p>
          </label>
          <label class="field">
            <span>${t("title")}</span>
            <input name="title" value="${attr(manifest.title)}" placeholder="${attr(t("mangaTitlePlaceholder"))}" />
          </label>
          <label class="field">
            <span>${t("artist")}</span>
            <input name="artist" value="${attr(manifest.artist)}" placeholder="${attr(t("artistPlaceholder"))}" />
          </label>
          <label class="field">
            <span>${t("author")}</span>
            <input name="author" value="${attr(manifest.author)}" placeholder="${attr(t("authorPlaceholder"))}" />
          </label>
          <label class="field">
            <span>${t("cover")}</span>
            <input name="cover" value="${attr(manifest.cover)}" placeholder="${attr(t("coverPlaceholder"))}" />
          </label>
        </div>

        <div class="field group editor-description-group">
          <label class="field">
            <span>${t("description")}</span>
            <textarea name="description" placeholder="${attr(t("descriptionPlaceholder"))}">${attr(manifest.description)}</textarea>
          </label>
        </div>
      </form>
      
      <div class="editor-chapter-actions">
        <button class="btn primary" id="add-chapter-btn">${t("addChapter")}</button>
      </div>
      
      <section class="panel" id="chapters-list">
        ${renderChapterCards(manifest)}
      </section>

      ${renderSavedLinks(current)}
    </section>
  `;
}
