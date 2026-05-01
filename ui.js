import { state } from "./state.js";

const app = document.querySelector("#app");

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

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
  if (!error) return label("Erro desconhecido.", "Unknown error.");
  if (error.status === 401) return label("Token inválido ou expirado. Confira o Personal Access Token.", "Invalid or expired token. Check the Personal Access Token.");
  if (error.status === 403) return label("Acesso negado. Confira se o token tem permissão de leitura/escrita no repositório.", "Access denied. Check whether the token has read/write permission for the repository.");
  if (error.status === 404) return label("Repositório, branch, pasta ou arquivo não encontrado.", "Repository, branch, folder, or file not found.");
  if (error.status === 409) return label("Conflito ao salvar. Atualize a lista e tente novamente.", "Save conflict. Refresh the list and try again.");
  return error.message || String(error);
}

