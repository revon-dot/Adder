import { FINE_GRAINED_TOKEN_URL } from "../state.js";
import { attr } from "../utils.js";

export function renderConnectPage(prefill = {}, imgchestToken = "") {
  const token = prefill.token || "";
  return `
    <header class="dashboard-header dashboard-compact connect-header">
      <div class="dashboard-main">
        <div class="dashboard-title-wrap">
          <button class="dashboard-logo logo-button back-logo-button" type="button" id="back-home-btn" aria-label="Voltar">‹</button>
          <div>
            <p class="kicker">Conexão</p>
            <h2>Conectar ao repositório</h2>
          </div>
        </div>
      </div>
    </header>

    <section class="panel">
      <div class="notice">
        <strong>Segurança:</strong> use um fine-grained Personal Access Token limitado apenas ao repositório que você quer editar. Marque “lembrar token” só em computador confiável.
      </div>

      <details class="guide-card">
        <summary>Como criar o Personal Access Token</summary>
        <div class="guide-content">
          <p>Use um <strong>Fine-grained token</strong>. Ele é mais seguro porque pode ficar limitado a um único repositório e só às permissões necessárias.</p>

          <a class="btn primary guide-link" href="${FINE_GRAINED_TOKEN_URL}" target="_blank" rel="noreferrer">Abrir criação do token no GitHub</a>

          <ol class="guide-steps">
            <li>Entre na sua conta do GitHub.</li>
            <li>Clique no botão acima ou vá em <strong>Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</strong>.</li>
            <li>Em <strong>Token name</strong>, coloque algo como <code>Adder Pages</code>.</li>
            <li>Em <strong>Expiration</strong>, escolha uma validade. Exemplo: <code>90 days</code>.</li>
            <li>Em <strong>Resource owner</strong>, escolha o dono do repositório: sua conta ou organização.</li>
            <li>Em <strong>Repository access</strong>, escolha <strong>Only select repositories</strong> e selecione apenas o repositório dos JSONs.</li>
            <li>Em <strong>Repository permissions</strong>, procure <strong>Contents</strong> e marque <strong>Read and write</strong>. O <strong>Metadata</strong> fica como leitura automaticamente.</li>
            <li>Clique em <strong>Generate token</strong>.</li>
            <li>Copie o token gerado e cole no campo <strong>Personal Access Token</strong> abaixo. O GitHub só mostra esse token uma vez.</li>
          </ol>

          <div class="copy-box">
            <strong>Permissão mínima para este site:</strong> Repository permissions → Contents → Read and write.
          </div>
        </div>
      </details>

      <form id="connect-form" class="form-grid" autocomplete="off">
        <label class="field">
          <span>GitHub username</span>
          <input name="username" value="${attr(prefill.username || prefill.owner || "")}" placeholder="seuusuario" required />
          <p class="hint">Usado só como identificação visual. O owner do repositório pode ser diferente.</p>
        </label>

        <label class="field">
          <span>Personal Access Token</span>
          <input name="token" value="${attr(token)}" placeholder="github_pat_..." type="password" required />
          <p class="hint">Precisa conseguir ler e escrever conteúdo no repositório.</p>
        </label>

        <label class="field">
          <span>Repository owner</span>
          <input name="owner" value="${attr(prefill.owner || prefill.username || "")}" placeholder="seuusuario-ou-org" required />
        </label>

        <label class="field">
          <span>Repository name</span>
          <input name="repo" value="${attr(prefill.repo || "")}" placeholder="meus-jsons-cubari" required />
        </label>

        <label class="field">
          <span>Branch</span>
          <input name="branch" value="${attr(prefill.branch || "main")}" placeholder="main" required />
        </label>

        <label class="field">
          <span>Pasta dos JSONs</span>
          <input name="jsonPath" value="${attr(prefill.jsonPath || "")}" placeholder="vazio = raiz do repositório" />
          <p class="hint">Exemplo: <code>series</code>, <code>json</code> ou deixe vazio para usar a raiz.</p>
        </label>

        <details class="guide-card span-2">
          <summary>ImgChest scraper opcional</summary>
          <div class="guide-content">
            <p>Para importar imagens direto de um álbum ImgChest no GitHub Pages, o jeito mais estável é usar o endpoint oficial do ImgChest com um API token do ImgChest. Sem token, o app ainda tenta ler a página pública, mas o navegador pode bloquear por CORS.</p>
            <label class="field">
              <span>ImgChest API token</span>
              <input name="imgchestToken" value="${attr(imgchestToken)}" placeholder="opcional" type="password" />
              <p class="hint">Esse token é diferente do token do GitHub. Ele só é usado na função “Importar ImgChest”.</p>
            </label>
            <label class="checkbox-row">
              <input name="rememberImgchestToken" type="checkbox" ${imgchestToken ? "checked" : ""} />
              <span>Lembrar ImgChest token neste navegador</span>
            </label>
          </div>
        </details>

        <label class="checkbox-row span-2">
          <input name="rememberToken" type="checkbox" ${token ? "checked" : ""} />
          <span>Lembrar token do GitHub neste navegador</span>
        </label>

        <div class="form-actions span-2">
          <button class="btn primary" type="submit">Conectar</button>
          <button class="btn ghost" type="button" id="clear-saved-btn">Limpar dados salvos</button>
        </div>
      </form>
    </section>
  `;
}
