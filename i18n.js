import { state } from "./state.js";

export const LANG_KEY = "adder-pages:lang";
export const LANGUAGES = ["pt-BR", "en-US"];

const translations = {
  "pt-BR": {
    languageLabel: "Idioma",
    languagePt: "PT",
    languageEn: "EN",
    landingKicker: "Adder Pages",
    landingTitle: "Editor Cubari direto no GitHub Pages.",
    landingLead: "Uma versão estática do Adder: você edita JSONs de mangás, capítulos, grupos e imagens pelo navegador, e salva direto no repositório usando a API do GitHub.",
    begin: "Começar",
    loadSaved: "Carregar dados salvos",
    howItWorks: "Como funciona",
    noSavedConfig: "Nenhuma configuração salva neste navegador.",
    savedConfig: "Config salva",
    tokenSaved: "token salvo neste navegador",
    tokenNotSaved: "token não salvo",
    dashboard: "Dashboard",
    library: "Biblioteca",
    newManga: "Novo mangá",
    refresh: "Atualizar",
    changeRepo: "Trocar repo",
    jsons: "JSONs",
    chapters: "capítulos",
    images: "imagens",
    searchPlaceholder: "Buscar por título ou arquivo...",
    noJsonFound: "Nenhum JSON encontrado",
    noJsonFoundDescription: "Não encontramos obras nesta pasta do repositório. Crie um novo mangá para começar ou revise a pasta configurada.",
    work: "Obra",
    file: "Arquivo",
    actions: "Ações",
    edit: "Editar",
    copyCubari: "Copiar Cubari",
  },
  "en-US": {
    languageLabel: "Language",
    languagePt: "PT",
    languageEn: "EN",
    landingKicker: "Adder Pages",
    landingTitle: "Cubari editor directly on GitHub Pages.",
    landingLead: "A static version of Adder: edit manga JSONs, chapters, groups, and images in your browser, then save directly to your repository using the GitHub API.",
    begin: "Start",
    loadSaved: "Load saved data",
    howItWorks: "How it works",
    noSavedConfig: "No saved configuration in this browser.",
    savedConfig: "Saved config",
    tokenSaved: "token saved in this browser",
    tokenNotSaved: "token not saved",
    dashboard: "Dashboard",
    library: "Library",
    newManga: "New manga",
    refresh: "Refresh",
    changeRepo: "Change repo",
    jsons: "JSONs",
    chapters: "chapters",
    images: "images",
    searchPlaceholder: "Search by title or file...",
    noJsonFound: "No JSON files found",
    noJsonFoundDescription: "We couldn't find any works in this repository folder. Create a new manga to get started or review the configured folder.",
    work: "Work",
    file: "File",
    actions: "Actions",
    edit: "Edit",
    copyCubari: "Copy Cubari",
  },
};

export function loadSavedLanguage() {
  const saved = localStorage.getItem(LANG_KEY);
  return LANGUAGES.includes(saved) ? saved : "pt-BR";
}

export function saveLanguage(lang) {
  const nextLang = LANGUAGES.includes(lang) ? lang : "pt-BR";
  state.lang = nextLang;
  localStorage.setItem(LANG_KEY, nextLang);
  document.documentElement.lang = nextLang === "en-US" ? "en" : "pt-BR";
  return nextLang;
}

export function t(key) {
  const lang = LANGUAGES.includes(state.lang) ? state.lang : "pt-BR";
  return translations[lang]?.[key] || translations["pt-BR"]?.[key] || key;
}

export function renderLanguageToggle(id = "language-toggle") {
  const lang = LANGUAGES.includes(state.lang) ? state.lang : "pt-BR";
  return `
    <div class="language-toggle" role="group" aria-label="${t("languageLabel")}">
      <button class="lang-option ${lang === "pt-BR" ? "active" : ""}" type="button" data-lang-toggle="pt-BR" id="${id}-pt">${t("languagePt")}</button>
      <button class="lang-option ${lang === "en-US" ? "active" : ""}" type="button" data-lang-toggle="en-US" id="${id}-en">${t("languageEn")}</button>
    </div>
  `;
}

export function bindLanguageToggle(onChange) {
  document.querySelectorAll("[data-lang-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextLang = button.dataset.langToggle;
      if (nextLang === state.lang) return;
      saveLanguage(nextLang);
      onChange?.(nextLang);
    });
  });
}
