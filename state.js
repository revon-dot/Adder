export const STORAGE_KEY = "adder-pages:v1";
export const TOKEN_KEY = "adder-pages:token";
export const IMG_TOKEN_KEY = "adder-pages:imgchest-token";
export const FINE_GRAINED_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new?name=Adder%20Pages&description=Editar%20JSONs%20Cubari%20via%20Adder%20Pages&expires_in=90&contents=write";

export const state = {
  client: null,
  config: null,
  files: [],
  current: null,
  search: "",
  lang: localStorage.getItem("adder-pages:lang") || "pt-BR",
  editor: {
    chapterSearch: "",
    chapterPage: 1,
    chapterPageSize: 10,
  },
  busy: false,
};

export function resetEditorListState() {
  state.editor.chapterSearch = "";
  state.editor.chapterPage = 1;
}

export function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConfig(config, rememberToken, rememberImgChestToken = false) {
  const safeConfig = { ...config };
  delete safeConfig.token;
  delete safeConfig.imgchestToken;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
  if (rememberToken) {
    localStorage.setItem(TOKEN_KEY, config.token || "");
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }

  if (rememberImgChestToken) {
    localStorage.setItem(IMG_TOKEN_KEY, config.imgchestToken || "");
  } else {
    localStorage.removeItem(IMG_TOKEN_KEY);
  }
}

export function clearSaved() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IMG_TOKEN_KEY);
}

export function getSavedToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getSavedImgChestToken() {
  return localStorage.getItem(IMG_TOKEN_KEY) || "";
}
