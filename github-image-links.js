import { githubPath } from "./github.js";

const DEFAULT_IMAGES_ROOT = "mangas";
const DEFAULT_LINK_MODE = "raw";

function stripJsonExtension(fileName = "") {
  return String(fileName || "")
    .trim()
    .replace(/\.json$/i, "");
}

function slugifySegment(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "manga";
}

function normalizeChapterFolder(chapterNumber = "") {
  const clean = String(chapterNumber || "")
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.]+/g, "");

  if (!clean) return "chapter";
  if (clean.includes(".")) return clean;
  return clean.padStart(4, "0");
}

export function mangaFolderFromJsonName(fileName = "") {
  return slugifySegment(stripJsonExtension(fileName));
}

export function buildGithubImageFolder({ imagesRoot = DEFAULT_IMAGES_ROOT, jsonFileName = "", chapterNumber = "" } = {}) {
  return githubPath.joinPath(
    imagesRoot,
    mangaFolderFromJsonName(jsonFileName),
    normalizeChapterFolder(chapterNumber),
  );
}

export function buildGithubImagePath({ imagesRoot = DEFAULT_IMAGES_ROOT, jsonFileName = "", chapterNumber = "", fileName = "" } = {}) {
  return githubPath.joinPath(
    buildGithubImageFolder({ imagesRoot, jsonFileName, chapterNumber }),
    fileName,
  );
}

export function buildRawGithubUrl({ owner = "", repo = "", branch = "main", path = "" } = {}) {
  const encodedPath = String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function buildGithubPagesUrl({ owner = "", repo = "", path = "" } = {}) {
  const encodedPath = String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `https://${encodeURIComponent(owner)}.github.io/${encodeURIComponent(repo)}/${encodedPath}`;
}

export function buildGithubImageUrl({ owner = "", repo = "", branch = "main", path = "", mode = DEFAULT_LINK_MODE } = {}) {
  if (mode === "pages") {
    return buildGithubPagesUrl({ owner, repo, path });
  }

  return buildRawGithubUrl({ owner, repo, branch, path });
}

export function buildGithubImageUploadItems({ config, jsonFileName, chapterNumber, images, imagesRoot = DEFAULT_IMAGES_ROOT, linkMode = DEFAULT_LINK_MODE } = {}) {
  return (images || []).map((image) => {
    const path = buildGithubImagePath({
      imagesRoot,
      jsonFileName,
      chapterNumber,
      fileName: image.fileName,
    });

    return {
      ...image,
      path,
      url: buildGithubImageUrl({
        owner: config?.owner,
        repo: config?.repo,
        branch: config?.branch,
        path,
        mode: linkMode,
      }),
    };
  });
}

export const githubImageDefaults = {
  imagesRoot: DEFAULT_IMAGES_ROOT,
  linkMode: DEFAULT_LINK_MODE,
};
