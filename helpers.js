import { state } from "./state.js";
import { GitHubClient } from "./github.js";
import { buildCubariGistUrl, sanitizeFileName, validateManifest, normalizeManifest } from "./cubari.js";
import { toast, setBusy, errorMessage } from "./ui.js";

export function ensureClient() {
  if (!state.config) throw new Error("Configuração ausente.");
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

export function collectManifestFromEditor(options = {}) {
  const form = document.querySelector("#editor-form");
  if (!form) return null;
  
  const formData = new FormData(form);
  const manifest = normalizeManifest({
    title: String(formData.get("title") || "").trim(),
    description: String(formData.get("description") || ""),
    artist: String(formData.get("artist") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    cover: String(formData.get("cover") || "").trim(),
    chapters: {},
  });

  const chapterCards = [...document.querySelectorAll("[data-chapter-card]")];
  const duplicateNumbers = new Set();
  const seen = new Set();

  for (const card of chapterCards) {
    const number = card.querySelector("[data-chapter-number]")?.value.trim();
    if (!number) continue;
    if (seen.has(number)) duplicateNumbers.add(number);
    seen.add(number);

    const chapter = {
      title: card.querySelector("[data-chapter-title]")?.value || "",
      volume: card.querySelector("[data-chapter-volume]")?.value || "",
      last_updated: card.querySelector("[data-chapter-updated]")?.value || String(Math.floor(Date.now() / 1000)),
      groups: {},
    };

    const groupCards = [...card.querySelectorAll("[data-group-card]")];
    for (const groupCard of groupCards) {
      const groupName = groupCard.querySelector("[data-group-name]")?.value.trim() || "";
      const imagesText = groupCard.querySelector("[data-group-images]")?.value || "";
      const images = imagesText
        .split(/\r?\n/)
        .map((url) => url.trim())
        .filter(Boolean);
      chapter.groups[groupName] = images;
    }

    if (!Object.keys(chapter.groups).length) chapter.groups[""] = [];
    manifest.chapters[number] = chapter;
  }

  const fileName = String(formData.get("fileName") || "").trim() || sanitizeFileName(manifest.title);
  const errors = [];
  if (duplicateNumbers.size) {
    errors.push(`Há capítulos duplicados: ${[...duplicateNumbers].join(", ")}.`);
  }

  const validation = validateManifest(manifest, fileName);
  validation.errors.unshift(...errors);

  if (!options.silent && validation.errors.length) {
    toast(validation.errors[0], "error");
  }

  return {
    manifest,
    fileName,
    validation,
  };
}

export function getNextChapterNumber() {
  const result = collectManifestFromEditor({ silent: true });
  if (!result) return "1";
  const { manifest } = result;
  const numbers = Object.keys(manifest.chapters || {})
    .map((value) => Number.parseFloat(value))
    .filter(Number.isFinite);
  return numbers.length ? String(Math.max(...numbers) + 1) : "1";
}

export async function deleteCurrentFile(navigateToDashboard) {
  if (!state.current || state.current.isNew) {
    toast("Não é possível deletar um arquivo que ainda não foi salvo.", "error");
    return;
  }

  if (!confirm("Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.")) {
    return;
  }

  try {
    setBusy(true);
    const client = ensureClient();
    await client.deleteFile({
      ...state.config,
      path: state.current.path,
      message: `Delete ${state.current.name} via Adder Pages`,
      sha: state.current.sha,
    });

    // Remove from files list
    state.files = state.files.filter(file => file.path !== state.current.path);
    
    toast("Obra excluída com sucesso.", "success");
    navigateToDashboard();
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}
