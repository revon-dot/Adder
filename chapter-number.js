export function normalizeChapterNumber(value = "") {
  const text = String(value || "").trim().replace(",", ".");
  const match = text.match(/^0*(\d+(?:\.\d+)?)/);

  if (!match) return text;

  return match[1];
}

export function isValidChapterNumber(value = "") {
  return /^\d+(?:\.\d+)?$/.test(String(value || "").trim());
}

export function addToChapterNumber(value, increment = 0) {
  const number = Number.parseFloat(String(value || "0").replace(",", "."));
  if (!Number.isFinite(number)) return String(increment + 1);

  const decimals = String(value || "").includes(".")
    ? String(value).split(".")[1].length
    : 0;

  return normalizeChapterNumber((number + increment).toFixed(decimals));
}

export function extractChapterNumberFromTitle(title = "") {
  const text = String(title || "").trim();
  if (!text) return null;

  const explicitMatch = text.match(
    /(?:cap[ií]tulo|chapter|chap\.?|ch\.?|epis[oó]dio|episode|ep\.?|#)\s*0*(\d+(?:\.\d+)?)/i
  );

  if (explicitMatch) return normalizeChapterNumber(explicitMatch[1]);

  const matches = [...text.matchAll(/\b0*(\d+(?:\.\d+)?)\b/g)];
  if (!matches.length) return null;

  return normalizeChapterNumber(matches[matches.length - 1][1]);
}
