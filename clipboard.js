import { toast } from "./ui.js";

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copiado.", "success");
  } catch {
    toast("Não consegui copiar automaticamente.", "error");
  }
}
