import { state } from "./state.js";
import { GitHubClient } from "./github.js";
import { buildCubariGistUrl } from "./cubari.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

export function ensureClient() {
  if (!state.config) throw new Error(label("Configuração ausente.", "Missing configuration."));
  state.client = new GitHubClient(state.config.token);
  return state.client;
}

export function repoLabel() {
  if (!state.config) return "";
  const path = state.config.jsonPath ? `/${state.config.jsonPath}` : "";
  return `${state.config.owner}/${state.config.repo} · ${state.config.branch}${path}`;
}

export function cubariUrlForPath(path) {
  if (!state.config || !path) return "";
  return buildCubariGistUrl({
    owner: state.config.owner,
    repo: state.config.repo,
    branch: state.config.branch,
    path,
  });
}
