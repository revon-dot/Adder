import { state, getSavedImgChestToken } from "../state.js";
import { setBusy, toast } from "../ui.js";
import { scrapeImgChestAlbum, extractImgChestLinksFromText } from "../imgchest.js";

export async function importImgChestIntoGroup(button, updateEditorStats = () => {}) {
  const groupCard = button.closest("[data-group-card]");
  const input = groupCard?.querySelector("[data-imgchest-url]");
  const textarea = groupCard?.querySelector("[data-group-images]");
  const albumUrl = input?.value.trim();

  if (!groupCard || !textarea) {
    toast("Não consegui encontrar o grupo deste capítulo.", "error");
    return;
  }

  if (!albumUrl) {
    toast("Cole a URL do álbum ImgChest primeiro.", "error");
    return;
  }

  let token = state.config?.imgchestToken || getSavedImgChestToken();
  if (!token) {
    token = prompt("Opcional: cole seu ImgChest API token para importar pelo endpoint oficial. Se deixar vazio, vou tentar ler a página pública, mas o navegador pode bloquear.") || "";
    if (token && state.config) state.config.imgchestToken = token.trim();
  }

  try {
    setBusy(true);
    button.disabled = true;
    button.textContent = "Importando...";
    const links = await scrapeImgChestAlbum(albumUrl, { token });
    if (!links.length) {
      toast("Nenhuma imagem encontrada no álbum.", "error");
      return;
    }
    textarea.value = links.join("\n");
    toast(`${links.length} imagens importadas do ImgChest.`, "success");
    updateEditorStats();
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    button.textContent = "Importar ImgChest";
    button.disabled = false;
    setBusy(false);
  }
}

export function extractImgChestFromTextarea(button, updateEditorStats = () => {}) {
  const groupCard = button.closest("[data-group-card]");
  const textarea = groupCard?.querySelector("[data-group-images]");
  if (!groupCard || !textarea) {
    toast("Não consegui encontrar o campo de imagens deste grupo.", "error");
    return;
  }

  const links = extractImgChestLinksFromText(textarea.value || "");
  if (!links.length) {
    toast("Não encontrei URLs cdn.imgchest.com no texto colado.", "error");
    return;
  }
  textarea.value = links.join("\n");
  toast(`${links.length} URLs ImgChest extraídas.`, "success");
  updateEditorStats();
}
