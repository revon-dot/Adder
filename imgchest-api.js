const API_BASE = "https://api.imgchest.com/v1";
const POST_URL_BASE = "https://imgchest.com/p";
const RATE_LIMIT_BACKOFF_MS = [60000, 90000, 120000, 180000, 300000];

let imgChestCooldownUntil = 0;

export const imgChestUploadDefaults = {
  privacy: "hidden",
  batchSize: 20,
  delayMs: 2500,
  rateLimitWaitMs: 90000,
  maxRateLimitWaitMs: 300000,
  maxRetries: 10,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanToken(token = "") {
  return String(token || "").trim();
}

function cleanPrivacy(privacy = imgChestUploadDefaults.privacy) {
  return ["public", "hidden", "secret"].includes(privacy) ? privacy : imgChestUploadDefaults.privacy;
}

function toPositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeBatchSize(value = imgChestUploadDefaults.batchSize) {
  return Math.min(20, Math.max(1, toPositiveInt(value, imgChestUploadDefaults.batchSize)));
}

function chunkList(items = [], size = imgChestUploadDefaults.batchSize) {
  const chunkSize = normalizeBatchSize(size);
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildHeaders(token) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${cleanToken(token)}`,
  };
}

function buildFilesFormData(images = [], extra = {}) {
  const formData = new FormData();

  Object.entries(extra).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    formData.append(key, String(value));
  });

  images.forEach((image) => {
    formData.append("images[]", image, image.name || "image");
  });

  return formData;
}

async function parseResponsePayload(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function errorMessageFromPayload(payload, fallback) {
  return payload?.message || payload?.error || payload?.errors?.[0]?.message || fallback;
}

function responseHeader(response, name) {
  try {
    return response?.headers?.get(name) || response?.headers?.get(name.toLowerCase()) || "";
  } catch {
    return "";
  }
}

function parseHeaderNumber(value) {
  const number = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(number) ? number : null;
}

function parseRetryAfterMs(value = "") {
  const clean = String(value || "").trim();
  if (!clean) return 0;

  if (/^\d+$/.test(clean)) {
    return Number(clean) * 1000;
  }

  const dateMs = Date.parse(clean);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return 0;
}

function parseRateLimitResetMs(value = "") {
  const number = Number(String(value || "").trim());
  if (!Number.isFinite(number) || number <= 0) return 0;

  // APIs commonly return X-RateLimit-Reset either as Unix seconds, Unix milliseconds,
  // or as a relative number of seconds. Support all three shapes defensively.
  if (number > 1_000_000_000_000) return Math.max(0, number - Date.now());
  if (number > 1_000_000_000) return Math.max(0, (number * 1000) - Date.now());
  return number * 1000;
}

function rateLimitInfoFromResponse(response) {
  const retryAfter = responseHeader(response, "Retry-After");
  const reset = responseHeader(response, "X-RateLimit-Reset");

  return {
    limit: parseHeaderNumber(responseHeader(response, "X-RateLimit-Limit")),
    remaining: parseHeaderNumber(responseHeader(response, "X-RateLimit-Remaining")),
    reset,
    resetMs: parseRateLimitResetMs(reset),
    retryAfter,
    retryAfterMs: parseRetryAfterMs(retryAfter),
  };
}

function clampWaitMs(waitMs, maxWaitMs) {
  if (!Number.isFinite(waitMs) || waitMs <= 0) return 0;
  return Math.min(waitMs, maxWaitMs);
}

function setSharedImgChestCooldown(waitMs) {
  if (!Number.isFinite(waitMs) || waitMs <= 0) return;
  imgChestCooldownUntil = Math.max(imgChestCooldownUntil, Date.now() + waitMs);
}

async function respectSharedImgChestCooldown(options = {}) {
  const waitMs = Math.max(0, imgChestCooldownUntil - Date.now());
  if (!waitMs) return;

  options.onRateLimit?.({
    attempt: 0,
    maxRetries: 0,
    waitMs,
    rateLimitInfo: null,
    soft: true,
    sharedCooldown: true,
  });
  await sleep(waitMs);
}

function rateLimitWaitMsForAttempt({ attempt, rateLimitWaitMs, maxRateLimitWaitMs, rateLimitInfo }) {
  const fallbackWaitMs = RATE_LIMIT_BACKOFF_MS[Math.min(attempt - 1, RATE_LIMIT_BACKOFF_MS.length - 1)] || rateLimitWaitMs;
  const headerWaitMs = Math.max(rateLimitInfo.retryAfterMs || 0, rateLimitInfo.resetMs || 0);
  const waitMs = headerWaitMs || fallbackWaitMs;
  return clampWaitMs(waitMs + 1500, maxRateLimitWaitMs);
}

async function waitAfterSuccessfulResponse(response, delayMs, options = {}) {
  const maxRateLimitWaitMs = toPositiveInt(options.maxRateLimitWaitMs, imgChestUploadDefaults.maxRateLimitWaitMs);
  const rateLimitInfo = rateLimitInfoFromResponse(response);

  if (rateLimitInfo.remaining !== null && rateLimitInfo.remaining <= 1) {
    const waitMs = clampWaitMs((rateLimitInfo.resetMs || imgChestUploadDefaults.rateLimitWaitMs) + 1500, maxRateLimitWaitMs);
    setSharedImgChestCooldown(waitMs);
    options.onRateLimit?.({
      attempt: 0,
      maxRetries: 0,
      waitMs,
      rateLimitInfo,
      soft: true,
      sharedCooldown: false,
    });
    await sleep(waitMs);
    return;
  }

  await sleep(delayMs);
}

function decorateHttpError(error, response, payload) {
  error.status = response.status;
  error.payload = payload;
  error.rateLimitInfo = rateLimitInfoFromResponse(response);
  if (response.status === 429) error.rateLimited = true;
  return error;
}

export async function requestWithImgChestRetry(requestFactory, options = {}) {
  const delayMs = toPositiveInt(options.delayMs, imgChestUploadDefaults.delayMs);
  const rateLimitWaitMs = toPositiveInt(options.rateLimitWaitMs, imgChestUploadDefaults.rateLimitWaitMs);
  const maxRateLimitWaitMs = toPositiveInt(options.maxRateLimitWaitMs, imgChestUploadDefaults.maxRateLimitWaitMs);
  const maxRetries = toPositiveInt(options.maxRetries, imgChestUploadDefaults.maxRetries);
  let lastRateLimitInfo = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    await respectSharedImgChestCooldown(options);

    let response;

    try {
      response = await requestFactory();
    } catch (error) {
      const message = String(error?.message || error || "").toLowerCase();
      if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("load failed")) {
        throw new Error("O navegador bloqueou ou não conseguiu acessar a API do ImgChest. Pode ser CORS, token inválido ou falha de rede.");
      }
      throw error;
    }

    const rateLimitInfo = rateLimitInfoFromResponse(response);

    if (response.status === 429) {
      lastRateLimitInfo = rateLimitInfo;
      const waitMs = rateLimitWaitMsForAttempt({
        attempt,
        rateLimitWaitMs,
        maxRateLimitWaitMs,
        rateLimitInfo,
      });

      setSharedImgChestCooldown(waitMs);
      options.onRateLimit?.({ attempt, maxRetries, waitMs, rateLimitInfo, soft: false, sharedCooldown: false });
      await sleep(waitMs);
      continue;
    }

    const payload = await parseResponsePayload(response);

    if (!response.ok) {
      throw decorateHttpError(
        new Error(errorMessageFromPayload(payload, `ImgChest API retornou HTTP ${response.status}.`)),
        response,
        payload,
      );
    }

    await waitAfterSuccessfulResponse(response, delayMs, options);
    return payload || {};
  }

  setSharedImgChestCooldown(maxRateLimitWaitMs);
  const error = new Error(`ImgChest API continuou em rate limit depois de ${maxRetries} tentativa(s). Tente novamente mais tarde ou reduza o tamanho do lote/delay.`);
  error.status = 429;
  error.rateLimited = true;
  error.rateLimitInfo = lastRateLimitInfo;
  throw error;
}

function extractPostData(payload = {}) {
  return payload?.data || payload?.post || payload || {};
}

export function extractImgChestPostIdFromPayload(payload = {}) {
  const data = extractPostData(payload);
  const id = data.id || data.post_id || payload.id || payload.post_id;
  if (!id) throw new Error("Não consegui encontrar o ID do post na resposta do ImgChest.");
  return String(id);
}

function imagePosition(image, index) {
  const position = Number(image?.position ?? image?.order ?? image?.index);
  return Number.isFinite(position) ? position : index;
}

function imageUrlFromItem(item = {}) {
  if (typeof item === "string") return item;
  return item.link || item.url || item.src || item.image_url || item.cdn_url || item.display_url || "";
}

export function extractImgChestImageUrlsFromPayload(payload = {}) {
  const data = extractPostData(payload);
  const candidates = [
    data.images,
    data.files,
    data.items,
    payload.images,
    payload.files,
    payload.items,
  ];

  const seen = new Set();
  const urls = [];

  candidates.forEach((candidate) => {
    if (!Array.isArray(candidate)) return;

    candidate
      .map((image, index) => ({ image, index }))
      .sort((a, b) => imagePosition(a.image, a.index) - imagePosition(b.image, b.index))
      .forEach(({ image }) => {
        const url = String(imageUrlFromItem(image) || "").trim();
        if (!url || seen.has(url)) return;
        seen.add(url);
        urls.push(url);
      });
  });

  return urls;
}

export async function createImgChestPost({ token, title, images, privacy, anonymous = false, nsfw = false, retry = {} } = {}) {
  const clean = cleanToken(token);
  if (!clean) throw new Error("Informe um ImgChest API token.");
  if (!Array.isArray(images) || !images.length) throw new Error("Nenhuma imagem para enviar ao ImgChest.");

  return requestWithImgChestRetry(
    () => fetch(`${API_BASE}/post`, {
      method: "POST",
      headers: buildHeaders(clean),
      body: buildFilesFormData(images, {
        title: String(title || "").trim(),
        privacy: cleanPrivacy(privacy),
        ...(anonymous ? { anonymous: "1" } : {}),
        ...(nsfw ? { nsfw: "1" } : {}),
      }),
    }),
    retry,
  );
}

export async function addImagesToImgChestPost({ token, postId, images, retry = {} } = {}) {
  const clean = cleanToken(token);
  if (!clean) throw new Error("Informe um ImgChest API token.");
  if (!postId) throw new Error("ID do post ImgChest ausente.");
  if (!Array.isArray(images) || !images.length) return {};

  return requestWithImgChestRetry(
    () => fetch(`${API_BASE}/post/${encodeURIComponent(postId)}/add`, {
      method: "POST",
      headers: buildHeaders(clean),
      body: buildFilesFormData(images),
    }),
    retry,
  );
}

export async function getImgChestPost({ token, postId, retry = {} } = {}) {
  const clean = cleanToken(token);
  if (!clean) throw new Error("Informe um ImgChest API token.");
  if (!postId) throw new Error("ID do post ImgChest ausente.");

  return requestWithImgChestRetry(
    () => fetch(`${API_BASE}/post/${encodeURIComponent(postId)}`, {
      headers: buildHeaders(clean),
    }),
    retry,
  );
}

export function buildImgChestPostUrl(postId) {
  return `${POST_URL_BASE}/${encodeURIComponent(postId)}`;
}

export function buildImgChestPostTitle({ albumName = "", folderName = "", chapterNumber = "", template = "{album} {chapter}" } = {}) {
  return String(template || "{album} {chapter}")
    .replaceAll("{album}", albumName)
    .replaceAll("{folder}", folderName)
    .replaceAll("{chapter}", chapterNumber)
    .trim();
}

export async function uploadChapterToImgChest({
  token,
  albumName,
  chapterGroup,
  titleTemplate = "{album} {chapter}",
  privacy = imgChestUploadDefaults.privacy,
  batchSize = imgChestUploadDefaults.batchSize,
  retry = {},
  onStatus,
} = {}) {
  if (!chapterGroup?.files?.length) throw new Error(`Capítulo ${chapterGroup?.number || "?"}: nenhuma imagem encontrada.`);

  const batches = chunkList(chapterGroup.files, batchSize);
  const title = buildImgChestPostTitle({
    albumName,
    folderName: chapterGroup.folder,
    chapterNumber: chapterGroup.number,
    template: titleTemplate,
  });

  onStatus?.({ phase: "create", batchIndex: 0, batchTotal: batches.length, title });
  const firstPayload = await createImgChestPost({
    token,
    title,
    images: batches[0],
    privacy,
    retry,
  });

  const postId = extractImgChestPostIdFromPayload(firstPayload);
  let imageUrls = extractImgChestImageUrlsFromPayload(firstPayload);

  for (let index = 1; index < batches.length; index += 1) {
    onStatus?.({ phase: "add", postId, batchIndex: index, batchTotal: batches.length, title });
    const addPayload = await addImagesToImgChestPost({
      token,
      postId,
      images: batches[index],
      retry,
    });
    imageUrls.push(...extractImgChestImageUrlsFromPayload(addPayload));
  }

  const expectedCount = chapterGroup.files.length;
  const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];

  if (uniqueUrls.length !== expectedCount) {
    onStatus?.({ phase: "refresh", postId, batchIndex: batches.length, batchTotal: batches.length, title });
    const postPayload = await getImgChestPost({ token, postId, retry });
    imageUrls = extractImgChestImageUrlsFromPayload(postPayload);
  }

  const finalUrls = [...new Set(imageUrls.filter(Boolean))];
  if (!finalUrls.length) {
    throw new Error(`Capítulo ${chapterGroup.number}: upload criado, mas a API não retornou links de imagens.`);
  }

  if (finalUrls.length !== expectedCount) {
    throw new Error(`Capítulo ${chapterGroup.number}: a API retornou ${finalUrls.length} link(s), mas eram esperadas ${expectedCount} imagem(ns).`);
  }

  return {
    number: chapterGroup.number,
    postId,
    postUrl: buildImgChestPostUrl(postId),
    title,
    imageUrls: finalUrls,
  };
}
