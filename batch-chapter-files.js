import { extractChapterNumberFromTitle, isValidChapterNumber, normalizeChapterNumber } from "./chapter-number.js";

export const SUPPORTED_LOCAL_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
]);

export const SUPPORTED_LOCAL_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";

export function naturalCompareByName(a, b) {
  return String(a?.name || a || "").localeCompare(String(b?.name || b || ""), "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export function fileExtension(file = {}) {
  const name = String(file?.name || "").toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

export function isSupportedLocalImageFile(file = {}) {
  return file instanceof File && SUPPORTED_LOCAL_IMAGE_EXTENSIONS.has(fileExtension(file));
}

export function filterSupportedLocalImages(files = []) {
  return Array.from(files).filter(isSupportedLocalImageFile).sort(naturalCompareByName);
}

export function getLocalFileRelativePath(file = {}) {
  return String(file?.webkitRelativePath || file?.name || "");
}

export function getLocalFilePathSegments(file = {}) {
  return getLocalFileRelativePath(file).split("/").filter(Boolean);
}

export function chapterFolderInfoForLocalFile(file = {}) {
  const parts = getLocalFilePathSegments(file);
  const folderParts = parts.slice(0, -1);

  for (let index = folderParts.length - 1; index >= 0; index -= 1) {
    const folder = folderParts[index];
    const number = extractChapterNumberFromTitle(folder);
    if (number && isValidChapterNumber(number)) {
      return {
        folder,
        number: normalizeChapterNumber(number),
        folderPath: folderParts.slice(0, index + 1).join("/"),
      };
    }
  }

  return null;
}

export function collectLocalChapterGroups(files = []) {
  const groups = new Map();
  const skipped = [];
  const duplicatePaths = new Map();

  filterSupportedLocalImages(files).forEach((file) => {
    const info = chapterFolderInfoForLocalFile(file);
    const skippedFolder = getLocalFilePathSegments(file).slice(0, -1).join("/") || file.name;

    if (!info) {
      if (!skipped.includes(skippedFolder)) skipped.push(skippedFolder);
      return;
    }

    if (groups.has(info.number) && groups.get(info.number).folderPath !== info.folderPath) {
      const paths = duplicatePaths.get(info.number) || new Set([groups.get(info.number).folderPath]);
      paths.add(info.folderPath);
      duplicatePaths.set(info.number, paths);
      return;
    }

    if (!groups.has(info.number)) {
      groups.set(info.number, {
        number: info.number,
        folder: info.folder,
        folderPath: info.folderPath,
        files: [],
      });
    }

    groups.get(info.number).files.push(file);
  });

  const chapters = [...groups.values()]
    .map((chapter) => ({
      ...chapter,
      files: [...chapter.files].sort(naturalCompareByName),
    }))
    .sort((a, b) => {
      const numericA = Number.parseFloat(a.number);
      const numericB = Number.parseFloat(b.number);
      if (Number.isFinite(numericA) && Number.isFinite(numericB) && numericA !== numericB) {
        return numericA - numericB;
      }
      return String(a.number).localeCompare(String(b.number), "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });

  const duplicates = [...duplicatePaths.entries()].map(([number, paths]) => ({
    number,
    folders: [...paths],
  }));

  return {
    chapters,
    skipped,
    duplicates,
  };
}

export function sumLocalFileSizes(files = []) {
  return Array.from(files).reduce((sum, file) => sum + (Number(file?.size) || 0), 0);
}

export function collectLocalChapterStats(files = []) {
  const { chapters, skipped, duplicates } = collectLocalChapterGroups(files);
  const imageCount = chapters.reduce((sum, chapter) => sum + chapter.files.length, 0);
  const size = chapters.reduce((sum, chapter) => sum + sumLocalFileSizes(chapter.files), 0);

  return {
    chapters,
    skipped,
    duplicates,
    imageCount,
    size,
  };
}
