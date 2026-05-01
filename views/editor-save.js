import { state } from "../state.js";
import { setBusy, toast, errorMessage } from "../ui.js";
import { githubPath } from "../github.js";
import { prettyJson } from "../cubari.js";
import { collectManifestFromEditor } from "../editor-collector.js";
import { ensureClient } from "../repo.js";
import { showValidationModal } from "../modals.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

function upsertSavedFileRecord({ oldPath, desiredPath, record, isRenamingExisting }) {
  const oldIndex = state.files.findIndex((file) => file.path === oldPath);
  const targetIndex = state.files.findIndex((file) => file.path === desiredPath);

  if (targetIndex >= 0) {
    state.files[targetIndex] = record;
    return;
  }

  if (!isRenamingExisting && oldIndex >= 0) {
    state.files[oldIndex] = record;
    return;
  }

  state.files.push(record);
}

export async function saveCurrentEditor(navigateToDashboard, renderEditor, makeSnapshot = null) {
  const result = collectManifestFromEditor();
  if (!result) return;
  const { manifest, fileName, validation } = result;
  if (validation.errors.length) {
    showValidationModal(validation);
    return;
  }

  if (validation.warnings.length) {
    const ok = confirm(
      `${label("Avisos encontrados:", "Warnings found:")}\n\n${validation.warnings.slice(0, 6).join("\n")}\n\n${label("Salvar mesmo assim?", "Save anyway?")}`,
    );
    if (!ok) return;
  }

  const client = ensureClient();
  const oldPath = state.current.path;
  const desiredPath = githubPath.joinPath(state.config.jsonPath, fileName);
  const isRenamingExisting = !state.current.isNew && oldPath !== desiredPath;
  const targetIndex = state.files.findIndex((file) => file.path === desiredPath);
  const existingTarget = targetIndex >= 0 ? state.files[targetIndex] : null;
  const isOverwritingDifferentFile = Boolean(existingTarget && existingTarget.path !== oldPath);

  if (isRenamingExisting) {
    const ok = confirm(label(
      "Você mudou o nome do arquivo. O Adder Pages vai criar ou atualizar o novo arquivo, mas não apaga automaticamente o antigo. Continuar?",
      "You changed the file name. Adder Pages will create or update the new file, but it will not automatically delete the old one. Continue?",
    ));
    if (!ok) return;
  }

  if (isOverwritingDifferentFile) {
    const ok = confirm(label(
      `Já existe um arquivo chamado ${fileName}. Salvar vai substituir esse JSON. Continuar?`,
      `A file named ${fileName} already exists. Saving will replace that JSON. Continue?`,
    ));
    if (!ok) return;
  }

  const targetSha = existingTarget?.sha || (!state.current.isNew && !isRenamingExisting ? state.current.sha : undefined);
  const message = `${state.current.isNew ? "Create" : "Update"} ${fileName} via Adder Pages`;

  try {
    setBusy(true);
    const saveResult = await client.putFile({
      ...state.config,
      path: desiredPath,
      text: prettyJson(manifest),
      message,
      sha: targetSha,
    });

    const savedContent = saveResult.content || {};
    state.current = {
      isNew: false,
      name: fileName,
      path: desiredPath,
      sha: savedContent.sha,
      htmlUrl: savedContent.html_url,
      downloadUrl: savedContent.download_url,
      data: manifest,
      savedSnapshot: makeSnapshot ? makeSnapshot(fileName, manifest) : state.current.savedSnapshot,
    };

    const record = {
      name: fileName,
      path: desiredPath,
      sha: savedContent.sha,
      htmlUrl: savedContent.html_url,
      downloadUrl: savedContent.download_url,
      data: manifest,
    };

    upsertSavedFileRecord({
      oldPath,
      desiredPath,
      record,
      isRenamingExisting,
    });

    toast(label("JSON salvo no GitHub.", "JSON saved to GitHub."), "success");
    renderEditor(navigateToDashboard);
  } catch (error) {
    toast(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
}
