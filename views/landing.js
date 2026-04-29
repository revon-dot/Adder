import { loadSavedConfig, getSavedToken, getSavedImgChestToken } from "../state.js";
import { render } from "../ui.js";
import { escapeHtml } from "../utils.js";

function showHowItWorksModal() {
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <section class="modal-card how-it-works-modal">
      <div class="panel-header">
        <div>
          <p class="kicker">Guia rápido</p>
          <h2>Como o Adder Pages funciona</h2>
          <p>O Adder Pages é um editor visual de JSONs compatíveis com Cubari. Ele roda no navegador e salva os arquivos direto no seu repositório GitHub.</p>
        </div>
        <button class="btn ghost small" type="button" data-close-modal>Fechar</button>
      </div>

      <div class="how-steps">
        <article>
          <strong>1. Conecte seu GitHub</strong>
          <p>Informe o dono do repositório, nome do repositório, branch, pasta dos JSONs e um Personal Access Token com permissão de leitura e escrita em conteúdo.</p>
        </article>
        <article>
          <strong>2. Carregue sua biblioteca</strong>
          <p>O dashboard lista os JSONs encontrados na pasta configurada. Cada obra pode ser aberta para edição.</p>
        </article>
        <article>
          <strong>3. Crie ou edite uma obra</strong>
          <p>Preencha título, autor, artista, capa e descrição. Depois adicione capítulos usando o editor lateral.</p>
        </article>
        <article>
          <strong>4. Adicione capítulos e imagens</strong>
          <p>Cada capítulo tem número, volume, grupo, título, data de atualização e URLs das imagens. Você pode importar URLs de um álbum ImgChest.</p>
        </article>
        <article>
          <strong>5. Salve no GitHub</strong>
          <p>Ao salvar, o JSON é atualizado no repositório configurado. O Adder não hospeda imagens nem publica conteúdo sozinho.</p>
        </article>
        <article>
          <strong>6. Copie o link Cubari</strong>
          <p>Depois de salvar, você pode copiar o link Cubari gerado para abrir a leitura usando o JSON salvo no GitHub.</p>
        </article>
      </div>

      <div class="notice">
        <strong>Observações:</strong> repositórios privados podem não funcionar no Cubari; ImgChest pode exigir token por causa de CORS; o token do GitHub deve ser usado apenas em computador confiável.
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
      <div class="hero-content">
        <p class="kicker">Adder Pages</p>
        <h1>Editor Cubari direto no GitHub Pages.</h1>
        <p class="lead">
          Uma versão estática do Adder: você edita JSONs de mangás, capítulos, grupos e imagens pelo navegador, e salva direto no repositório usando a API do GitHub.
        </p>
        <div class="hero-actions">
          <button class="btn primary" id="begin-btn">Começar</button>
          <button class="btn ghost" id="load-saved-btn" ${saved ? "" : "disabled"}>Carregar dados salvos</button>
          <button class="btn ghost" id="how-it-works-btn">Como funciona</button>
        </div>
        <p class="footer-note">
          ${saved ? `Config salva: <strong>${escapeHtml(saved.owner)}/${escapeHtml(saved.repo)}</strong>${hasToken ? " · token salvo neste navegador" : " · token não salvo"}` : "Nenhuma configuração salva neste navegador."}
        </p>
      </div>
    </section>
  `);

  document.querySelector("#begin-btn").addEventListener("click", () => navigateToConnect(saved || {}));
  document.querySelector("#how-it-works-btn")?.addEventListener("click", showHowItWorksModal);
  document.querySelector("#load-saved-btn")?.addEventListener("click", () => {
    const config = loadSavedConfig();
    if (!config) return navigateToConnect({});
    navigateToConnect({ ...config, token: getSavedToken(), imgchestToken: getSavedImgChestToken() });
  });
}
