import { state } from "./state.js";
import { ensureClient } from "./repo.js";
import { toast, setBusy, errorMessage } from "./ui.js";

export async function deleteCurrentFile(navigateToDashboard) {
  if (!state.current || state.current.isNew) {
    toast("Não é possível deletar um arquivo que ainda não foi salvo.", "error");
    return;
  }

  if (!confirm("Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita.")) {
    return;
  }

  try {
    setBusy(true);
    const client = ensureClient();
    await client.deleteFile({
      ...state.config,
      path: state.current.path,
      message: `Delete ${state.current.name} via Adder Pages`,
      sha: state.current.sha,
    });

    // Remove from files list
    state.files = state.files.filter(file => file.path !== state.current.path);
    
    toast("Obra excluída com sucesso.", "success");
    navigateToDashboard();
  } catch (error) {
    console.error("Erro ao deletar arquivo:", error);
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}
