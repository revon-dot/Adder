export function emptyManifest() {
  return {
    title: "",
    description: "",
    artist: "",
    author: "",
    cover: "",
    chapters: {},
  };
}

export function emptyChapter() {
  return {
    title: "",
    volume: "",
    last_updated: String(Math.floor(Date.now() / 1000)),
    groups: {
      "": [],
    },
  };
}

export function normalizeManifest(input = {}) {
  const manifest = {
    ...emptyManifest(),
    ...input,
    chapters: input && typeof input.chapters === "object" && !Array.isArray(input.chapters) ? input.chapters : {},
  };

  for (const [number, chapter] of Object.entries(manifest.chapters)) {
    const normalizedChapter = {
      ...emptyChapter(),
      ...(chapter && typeof chapter === "object" ? chapter : {}),
    };

    if (!normalizedChapter.groups || typeof normalizedChapter.groups !== "object" || Array.isArray(normalizedChapter.groups)) {
      normalizedChapter.groups = { "": [] };
    }

    for (const [groupName, images] of Object.entries(normalizedChapter.groups)) {
      normalizedChapter.groups[groupName] = Array.isArray(images)
        ? images.filter(Boolean).map(String)
        : String(images || "")
            .split(/\r?\n/)
            .map((url) => url.trim())
            .filter(Boolean);
    }

    manifest.chapters[number] = normalizedChapter;
  }

  return manifest;
}

export function sortChapterEntries(chapters = {}) {
  return Object.entries(chapters).sort(([a], [b]) => {
    const numA = Number.parseFloat(a);
    const numB = Number.parseFloat(b);
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      return numA - numB;
    }
    return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
  });
}

export function countImages(manifest = {}) {
  return Object.values(manifest.chapters || {}).reduce((total, chapter) => {
    return total + Object.values(chapter.groups || {}).reduce((sum, images) => sum + (Array.isArray(images) ? images.length : 0), 0);
  }, 0);
}

export function countGroups(manifest = {}) {
  return Object.values(manifest.chapters || {}).reduce((total, chapter) => {
    return total + Object.keys(chapter.groups || {}).length;
  }, 0);
}

export function sanitizeFileName(title) {
  const base = String(title || "manga")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "manga";
  return base.endsWith(".json") ? base : `${base}.json`;
}

export function validateManifest(manifest = {}, fileName = "") {
  const errors = [];
  const warnings = [];

  if (!String(fileName || "").trim().toLowerCase().endsWith(".json")) {
    errors.push("O nome do arquivo precisa terminar com .json.");
  }

  if (!String(manifest.title || "").trim()) {
    errors.push("O título do mangá é obrigatório.");
  }

  if (!manifest.chapters || typeof manifest.chapters !== "object" || Array.isArray(manifest.chapters)) {
    errors.push("O campo chapters precisa ser um objeto.");
    return { errors, warnings };
  }

  const chapterNumbers = Object.keys(manifest.chapters);
  if (chapterNumbers.length === 0) {
    warnings.push("O mangá ainda não tem capítulos.");
  }

  for (const [chapterNumber, chapter] of Object.entries(manifest.chapters)) {
    if (!String(chapterNumber || "").trim()) {
      errors.push("Existe um capítulo sem número.");
    }

    if (!chapter.groups || typeof chapter.groups !== "object" || Array.isArray(chapter.groups)) {
      errors.push(`O capítulo ${chapterNumber} não possui groups válido.`);
      continue;
    }

    const groupEntries = Object.entries(chapter.groups);
    if (groupEntries.length === 0) {
      warnings.push(`O capítulo ${chapterNumber} não possui grupos.`);
    }

    for (const [groupName, images] of groupEntries) {
      if (!Array.isArray(images)) {
        errors.push(`O grupo ${groupName || "sem nome"} do capítulo ${chapterNumber} não é uma lista de imagens.`);
        continue;
      }

      if (images.length === 0) {
        warnings.push(`O grupo ${groupName || "sem nome"} do capítulo ${chapterNumber} não tem imagens.`);
      }

      images.forEach((url, index) => {
        if (!/^https?:\/\//i.test(String(url))) {
          warnings.push(`Imagem ${index + 1} do capítulo ${chapterNumber} não parece ser uma URL http(s).`);
        }
      });
    }
  }

  return { errors, warnings };
}

export function prettyJson(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}


function encodeBase64Unicode(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function buildCubariGistUrl({ owner, repo, branch, path }) {
  const cleanPath = String(path || "").replace(/^\/+|\/+$/g, "");
  if (!owner || !repo || !branch || !cleanPath) return "";
  const payload = `${owner}/${repo}/${branch}/${cleanPath}`;
  return `https://cubari.moe/read/gist/${encodeURIComponent(encodeBase64Unicode(payload))}/`;
}
