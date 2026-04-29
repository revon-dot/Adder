import { FINE_GRAINED_TOKEN_URL, state } from "../state.js";
import { attr } from "../utils.js";
import { renderLanguageToggle, t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

function backIcon() {
  return `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M15 18 9 12l6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

export function renderConnectPage(prefill = {}, imgchestToken = "") {
  const token = prefill.token || "";
  return `
    <header class="dashboard-header dashboard-compact connect-header">
      <div class="dashboard-main">
        <div class="dashboard-title-wrap">
          <button class="dashboard-logo logo-button back-logo-button" type="button" id="back-home-btn" aria-label="${t("back")}">${backIcon()}</button>
          <div>
            <p class="kicker">${t("connection")}</p>
            <h2>${label("Conectar ao Repositório", "Connect Repository")}</h2>
          </div>
        </div>
      </div>
      <div class="toolbar dashboard-toolbar">
        ${renderLanguageToggle("connect-language")}
      </div>
    </header>

    <section class="panel">
      <div class="notice">
        <strong>${t("security")}</strong> ${t("securityNotice")}
      </div>

      <details class="guide-card">
        <summary>${t("tokenGuide")}</summary>
        <div class="guide-content">
          <p>${t("tokenGuideIntro")}</p>

          <a class="btn primary guide-link" href="${FINE_GRAINED_TOKEN_URL}" target="_blank" rel="noreferrer">${t("openTokenCreation")}</a>

          <ol class="guide-steps">
            <li>${stateLangStep(1)}</li>
            <li>${stateLangStep(2)}</li>
            <li>${stateLangStep(3)}</li>
            <li>${stateLangStep(4)}</li>
            <li>${stateLangStep(5)}</li>
            <li>${stateLangStep(6)}</li>
            <li>${stateLangStep(7)}</li>
            <li>${stateLangStep(8)}</li>
            <li>${stateLangStep(9)}</li>
          </ol>

          <div class="copy-box">
            <strong>${t("minPermission")}</strong> Repository permissions → Contents → Read and write.
          </div>
        </div>
      </details>

      <form id="connect-form" class="form-grid" autocomplete="off">
        <label class="field">
          <span>${t("githubUsername")}</span>
          <input name="username" value="${attr(prefill.username || prefill.owner || "")}" placeholder="${attr(t("usernamePlaceholder"))}" required />
          <p class="hint">${t("usernameHint")}</p>
        </label>

        <label class="field">
          <span>${t("personalAccessToken")}</span>
          <input name="token" value="${attr(token)}" placeholder="${attr(t("tokenPlaceholder"))}" type="password" required />
          <p class="hint">${t("tokenHint")}</p>
        </label>

        <label class="field">
          <span>${t("repositoryOwner")}</span>
          <input name="owner" value="${attr(prefill.owner || prefill.username || "")}" placeholder="${attr(t("repositoryOwnerPlaceholder"))}" required />
        </label>

        <label class="field">
          <span>${t("repositoryName")}</span>
          <input name="repo" value="${attr(prefill.repo || "")}" placeholder="${attr(t("repositoryNamePlaceholder"))}" required />
        </label>

        <label class="field branch-field">
          <span>${t("branch")}</span>
          <input name="branch" value="${attr(prefill.branch || "main")}" placeholder="${attr(t("branchPlaceholder"))}" required />
        </label>

        <label class="field">
          <span>${t("jsonFolder")}</span>
          <input name="jsonPath" value="${attr(prefill.jsonPath || "")}" placeholder="${attr(t("jsonFolderPlaceholder"))}" />
          <p class="hint">${t("jsonFolderHint")}</p>
        </label>

        <details class="guide-card span-2">
          <summary>${label("ImgChest Scraper", "ImgChest Scraper")}</summary>
          <div class="guide-content">
            <p>${t("imgChestHelp")}</p>
            <label class="field">
              <span>${t("imgChestApiToken")}</span>
              <input name="imgchestToken" value="${attr(imgchestToken)}" placeholder="${attr(t("imgChestTokenPlaceholder"))}" type="password" />
              <p class="hint">${t("imgChestTokenHint")}</p>
            </label>
            <label class="checkbox-row">
              <input name="rememberImgchestToken" type="checkbox" ${imgchestToken ? "checked" : ""} />
              <span>${t("rememberImgChestToken")}</span>
            </label>
          </div>
        </details>

        <label class="checkbox-row span-2">
          <input name="rememberToken" type="checkbox" ${token ? "checked" : ""} />
          <span>${t("rememberGithubToken")}</span>
        </label>

        <div class="form-actions span-2">
          <button class="btn primary" type="submit">${t("connect")}</button>
          <button class="btn ghost" type="button" id="clear-saved-btn">${label("Limpar Dados Salvos", "Clear Saved Data")}</button>
        </div>
      </form>
    </section>
  `;
}

function stateLangStep(step) {
  const steps = {
    "pt-BR": {
      1: "Entre na sua conta do GitHub.",
      2: "Clique no botão acima ou vá em Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.",
      3: "Em Token name, coloque algo como Adder Pages.",
      4: "Em Expiration, escolha uma validade. Exemplo: 90 days.",
      5: "Em Resource owner, escolha o dono do repositório: sua conta ou organização.",
      6: "Em Repository access, escolha Only select repositories e selecione apenas o repositório dos JSONs.",
      7: "Em Repository permissions, procure Contents e marque Read and write. O Metadata fica como leitura automaticamente.",
      8: "Clique em Generate token.",
      9: "Copie o token gerado e cole no campo Personal Access Token abaixo. O GitHub só mostra esse token uma vez.",
    },
    "en-US": {
      1: "Sign in to your GitHub account.",
      2: "Click the button above or go to Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.",
      3: "In Token name, use something like Adder Pages.",
      4: "In Expiration, choose an expiration date. Example: 90 days.",
      5: "In Resource owner, choose the repository owner: your account or organization.",
      6: "In Repository access, choose Only select repositories and select only the JSON repository.",
      7: "In Repository permissions, find Contents and set it to Read and write. Metadata stays read-only automatically.",
      8: "Click Generate token.",
      9: "Copy the generated token and paste it into the Personal Access Token field below. GitHub only shows the token once.",
    },
  };
  return steps[state.lang === "en-US" ? "en-US" : "pt-BR"][step];
}
