import { state, STORAGE_KEY, TOKEN_KEY, IMG_TOKEN_KEY } from "../state.js";
import { loadSavedConfig, getSavedToken, getSavedImgChestToken } from "../state.js";
import { render } from "../ui.js";
import { escapeHtml } from "../utils.js";

export function renderLanding(navigateToConnect) {
  const saved = loadSavedConfig();
  const hasToken = Boolean(getSavedToken());
  render(`
    <section class="hero">
      <div class="hero-content">
        <p class="kicker">Adder Pages</p>
        <h1>Editor Cubari direto no GitHub Pages.</h1>
        <p class="lead">
          Uma versão estática do Adder: você edita JSONs de mangás, capítulos, grupos e imagens pelo navegador, e salva direto no repositório usando a API do GitHub.
        </p>
        <div class="hero-actions">
          <button class="btn primary" id="begin-btn">Começar</button>
          <button class="btn ghost" id="load-saved-btn" ${saved ? "" : "disabled"}>Carregar dados Salvos</button>
        </div>
        <p class="footer-note">
          ${saved ? `Config salva: <strong>${escapeHtml(saved.owner)}/${escapeHtml(saved.repo)}</strong>${hasToken ? " · token salvo neste navegador" : " · token não salvo"}` : "Nenhuma configuração salva neste navegador."}
        </p>
      </div>
    </section>
  `);

  document.querySelector("#begin-btn").addEventListener("click", () => navigateToConnect(saved || {}));
  document.querySelector("#load-saved-btn")?.addEventListener("click", () => {
    const config = loadSavedConfig();
    if (!config) return navigateToConnect({});
    navigateToConnect({ ...config, token: getSavedToken(), imgchestToken: getSavedImgChestToken() });
  });
}
