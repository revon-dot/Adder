import { loadSavedConfig, getSavedToken, getSavedImgChestToken } from "../state.js";
import { render } from "../ui.js";
import { escapeHtml } from "../utils.js";
import { bindLanguageToggle, renderLanguageToggle, t } from "../i18n.js";

function label(pt, en) {
  return document.documentElement.lang === "en" ? en : pt;
}

function showHowItWorksModal() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal-card how-it-works-modal">
      <div class="panel-header">
        <div>
          <p class="kicker">${t("howGuideKicker")}</p>
          <h2>${t("howTitle")}</h2>
          <p>${t("howIntro")}</p>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>${t("close")}</button>
      </div>

      <div class="how-steps">
        <article>
          <strong>${t("howStep1Title")}</strong>
          <p>${t("howStep1Text")}</p>
        </article>
        <article>
          <strong>${t("howStep2Title")}</strong>
          <p>${t("howStep2Text")}</p>
        </article>
        <article>
          <strong>${t("howStep3Title")}</strong>
          <p>${t("howStep3Text")}</p>
        </article>
        <article>
          <strong>${t("howStep4Title")}</strong>
          <p>${t("howStep4Text")}</p>
        </article>
        <article>
          <strong>${t("howStep5Title")}</strong>
          <p>${t("howStep5Text")}</p>
        </article>
        <article>
          <strong>${t("howStep6Title")}</strong>
          <p>${t("howStep6Text")}</p>
        </article>
      </div>

      <div class="notice">
        <strong>${t("howNotesLabel")}</strong> ${t("howNotesText")}
      </div>
    </section>
  `;

  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector("[data-close-modal]")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
}

export function renderLanding(navigateToConnect) {
  const saved = loadSavedConfig();
  const hasToken = Boolean(getSavedToken());
  render(`
    <section class="hero">
      <div class="landing-language-wrap">
        ${renderLanguageToggle("landing-language")}
      </div>
      <div class="hero-content">
        <p class="kicker">${t("landingKicker")}</p>
        <h1>${t("landingTitle")}</h1>
        <p class="lead">
          ${t("landingLead")}
        </p>
        <div class="hero-actions">
          <button class="btn primary" id="begin-btn">${t("begin")}</button>
          <button class="btn ghost" id="load-saved-btn" ${saved ? "" : "disabled"}>${label("Carregar Dados Salvos", "Load Saved Data")}</button>
          <button class="btn ghost" id="how-it-works-btn">${label("Como Funciona", "How It Works")}</button>
        </div>
        <p class="footer-note">
          ${saved ? `${t("savedConfig")}: <strong>${escapeHtml(saved.owner)}/${escapeHtml(saved.repo)}</strong>${hasToken ? ` · ${t("tokenSaved")}` : ` · ${t("tokenNotSaved")}`}` : t("noSavedConfig")}
        </p>
      </div>
    </section>
  `);

  bindLanguageToggle(() => renderLanding(navigateToConnect));
  document.querySelector("#begin-btn").addEventListener("click", () => navigateToConnect(saved || {}));
  document.querySelector("#how-it-works-btn")?.addEventListener("click", showHowItWorksModal);
  document.querySelector("#load-saved-btn")?.addEventListener("click", () => {
    const config = loadSavedConfig();
    if (!config) return navigateToConnect({});
    navigateToConnect({ ...config, token: getSavedToken(), imgchestToken: getSavedImgChestToken() });
  });
}
