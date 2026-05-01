import { state } from "./state.js";

const API_BASE = "https://api.github.com";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

function encodePath(path = "") {
  return String(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function stripSlashes(path = "") {
  return String(path).trim().replace(/^\/+|\/+$/g, "");
}

function joinPath(...parts) {
  return parts
    .map((part) => stripSlashes(part))
    .filter(Boolean)
    .join("/");
}

export function decodeBase64Unicode(base64) {
  const binary = atob(String(base64).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function encodeBase64Unicode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function stripDataUrlPrefix(base64 = "") {
  return String(base64).replace(/^data:[^;]+;base64,/, "");
}

export class GitHubClient {
  constructor(token) {
    this.token = String(token || "").trim();
  }

  headers(extra = {}) {
    return {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...extra,
    };
  }

  async request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: this.headers(options.headers),
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      const message = payload?.message || payload || label(`Erro HTTP ${response.status}`, `HTTP error ${response.status}`);
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async getAuthenticatedUser() {
    return this.request("/user");
  }

  async getRepo({ owner, repo }) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  }

  async listBranches({ owner, repo }) {
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`);
  }

  async listContents({ owner, repo, branch, path = "" }) {
    const cleanPath = encodePath(path);
    const suffix = cleanPath ? `/${cleanPath}` : "";
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${suffix}${ref}`);
  }

  async listJsonFiles({ owner, repo, branch, path = "" }) {
    const contents = await this.listContents({ owner, repo, branch, path });
    const list = Array.isArray(contents) ? contents : [contents];
    return list
      .filter((item) => item.type === "file" && item.name.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  }

  async getFile({ owner, repo, branch, path }) {
    const file = await this.listContents({ owner, repo, branch, path });
    if (Array.isArray(file) || file.type !== "file") {
      throw new Error(label("O caminho informado não é um arquivo.", "The provided path is not a file."));
    }
    return {
      ...file,
      text: decodeBase64Unicode(file.content || ""),
    };
  }

  async putFile({ owner, repo, branch, path, text, message, sha }) {
    const cleanPath = encodePath(path);
    const body = {
      message: message || `Update ${path}`,
      content: encodeBase64Unicode(text),
      branch,
      ...(sha ? { sha } : {}),
    };

    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async putBase64File({ owner, repo, branch, path, base64Content, message, sha }) {
    const cleanPath = encodePath(path);
    const body = {
      message: message || `Upload ${path}`,
      content: stripDataUrlPrefix(base64Content),
      branch,
      ...(sha ? { sha } : {}),
    };

    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async deleteFile({ owner, repo, branch, path, message, sha }) {
    const cleanPath = encodePath(path);
    return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch }),
    });
  }
}

export const githubPath = {
  stripSlashes,
  joinPath,
};
