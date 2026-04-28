import { state } from "./state.js";
import { escapeHtml, attr } from "./utils.js";

const app = document.querySelector("#app");

export function render(markup) {
  app.innerHTML = `<div class="app-shell">${markup}</div>`;
}

export function setBusy(isBusy) {
  state.busy = isBusy;
  document.querySelectorAll("button, input, textarea, select").forEach((element) => {
    if (element.dataset.keepEnabled === "true") return;
    if (element.matches("button")) element.disabled = isBusy;
  });
}

export function toast(message, type = "") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const node = document.createElement("div");
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  wrap.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

export function errorMessage(error) {
  if (!error) return "Erro desconhecido.";
  if (error.status === 401) return "Token inválido ou expirado. Confira o Personal Access Token.";
  if (error.status === 403) return "Acesso negado. Confira se o token tem permissão de leitura/escrita no repositório.";
  if (error.status === 404) return "Repositório, branch, pasta ou arquivo não encontrado.";
  if (error.status === 409) return "Conflito ao salvar. Atualize a lista e tente novamente.";
  return error.message || String(error);
}

