const IMG_OK = /^https:\/\/cdn\.imgchest\.com\/files\/(?!thumb\/|avatar\/).+\.(png|jpe?g|webp|gif)(\?.*)?$/i;
const CDN_URL_RE = /https:\/\/cdn\.imgchest\.com\/files\/(?!thumb\/|avatar\/)[^\s"'<>\\)]+?\.(?:png|jpe?g|webp|gif)(?:\?[^\s"'<>\\)]*)?/gi;
const ALLOWED_ALBUM_HOSTS = new Set(["imgchest.com", "www.imgchest.com"]);

function cleanUrl(url = "") {
  return String(url)
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/[),.;]+$/g, "");
}

function uniqueValidLinks(values = []) {
  const seen = new Set();
  const links = [];

  for (const raw of values) {
    const url = cleanUrl(raw);
    if (!IMG_OK.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

function normalizeImgChestAlbumUrl(albumUrl = "") {
  let url;
  try {
    url = new URL(String(albumUrl).trim());
  } catch {
    throw new Error("URL do álbum ImgChest inválida.");
  }

  if (!ALLOWED_ALBUM_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("A URL precisa ser de um álbum do imgchest.com.");
  }

  return url.toString();
}

function isLikelyCorsError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("networkerror") || message.includes("load failed");
}

function imagePosition(image, index) {
  const position = Number(image?.position);
  return Number.isFinite(position) ? position : index;
}

export function extractImgChestPostId(albumUrl = "") {
  try {
    const url = new URL(String(albumUrl).trim());
    const parts = url.pathname.split("/").filter(Boolean);
    const pIndex = parts.findIndex((part) => ["p", "post", "posts", "a", "album"].includes(part.toLowerCase()));
    if (pIndex >= 0 && parts[pIndex + 1]) return parts[pIndex + 1];
    return parts[0] || "";
  } catch {
    return "";
  }
}

export function extractImgChestLinksFromText(text = "") {
  const matches = String(text).match(CDN_URL_RE) || [];
  return uniqueValidLinks(matches);
}

function extractLinksFromHtml(html = "") {
  const regexLinks = extractImgChestLinksFromText(html);

  try {
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    const domLinks = [];

    doc.querySelectorAll("img, a, source").forEach((element) => {
      for (const attr of ["src", "href", "data-src", "data-original", "data-lazy-src", "srcset"]) {
        const value = element.getAttribute(attr);
        if (!value) continue;
        if (attr === "srcset") {
          value.split(",").forEach((item) => domLinks.push(item.trim().split(/\s+/)[0]));
        } else {
          domLinks.push(value);
        }
      }
    });

    // Prefer the raw HTML scan first because it preserves the same order the links appear in the album page.
    // DOM extraction remains as fallback for lazy-loaded attributes that may not be caught by the regex.
    return uniqueValidLinks([...regexLinks, ...domLinks]);
  } catch {
    return regexLinks;
  }
}

async function getPostWithApi(postId, token = "") {
  if (!postId) throw new Error("Não consegui identificar o ID do álbum ImgChest.");
  if (!token) throw new Error("Para importar pelo endpoint oficial do ImgChest, informe um ImgChest API token.");

  const response = await fetch(`https://api.imgchest.com/v1/post/${encodeURIComponent(postId)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `ImgChest API retornou HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const images = Array.isArray(payload?.data?.images) ? payload.data.images : [];
  return uniqueValidLinks(
    images
      .map((image, index) => ({ image, index }))
      .sort((a, b) => imagePosition(a.image, a.index) - imagePosition(b.image, b.index))
      .map(({ image }) => image.link)
  );
}

async function scrapePublicPage(albumUrl = "") {
  try {
    const response = await fetch(albumUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Não consegui ler a página ImgChest. HTTP ${response.status}.`);
    const html = await response.text();
    return extractLinksFromHtml(html);
  } catch (error) {
    if (isLikelyCorsError(error)) {
      throw new Error("O navegador bloqueou a leitura da página pública do ImgChest por CORS.");
    }
    throw error;
  }
}

export async function scrapeImgChestAlbum(albumUrl = "", options = {}) {
  const rawUrl = String(albumUrl || "").trim();
  if (!rawUrl) return [];

  const url = normalizeImgChestAlbumUrl(rawUrl);
  const postId = extractImgChestPostId(url);
  const token = String(options.token || "").trim();
  const errors = [];

  if (token) {
    try {
      const links = await getPostWithApi(postId, token);
      if (links.length) return links;
      errors.push("A API do ImgChest respondeu, mas não retornou imagens.");
    } catch (error) {
      errors.push(error.message || String(error));
    }
  }

  try {
    const links = await scrapePublicPage(url);
    if (links.length) return links;
    errors.push("A página foi lida, mas não encontrei URLs CDN do ImgChest.");
  } catch (error) {
    errors.push(error.message || String(error));
  }

  throw new Error(
    `Não consegui importar este álbum ImgChest. ${errors.join(" ")} ` +
      "Em GitHub Pages não dá para rodar Playwright/Python; use um ImgChest API token ou cole as URLs CDN manualmente."
  );
}
