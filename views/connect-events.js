import { state, saveConfig, clearSaved } from "../state.js";
import { setBusy, toast, errorMessage } from "../ui.js";
import { githubPath } from "../github.js";
import { ensureClient } from "../repo.js";
import { bindLanguageToggle, t } from "../i18n.js";

function label(pt, en) {
  return state.lang === "en-US" ? en : pt;
}

function isMissingPathError(error) {
  return error?.status === 404 || error?.status === 409;
}

async function validateConnection(client, config) {
  await client.getRepo(config);

  const branches = await client.listBranches(config);
  const branchExists = Array.isArray(branches)
    ? branches.some((branch) => branch?.name === config.branch)
    : false;

  if (!branchExists) {
    throw new Error(label(
      `Branch "${config.branch}" não encontrada em ${config.owner}/${config.repo}. Confira o nome da branch antes de continuar.`,
      `Branch "${config.branch}" was not found in ${config.owner}/${config.repo}. Check the branch name before continuing.`,
    ));
  }

  try {
    await client.listContents({
      ...config,
      path: config.jsonPath,
    });
    return { pathReady: true };
  } catch (error) {
    if (isMissingPathError(error)) {
      return { pathReady: false };
    }
    throw error;
  }
}

export function bindConnectEvents({ navigateToLanding, navigateToDashboard, renderConnect }) {
  bindLanguageToggle(() => renderConnect({ ...state.config }, navigateToLanding, navigateToDashboard));
  document.querySelector("#back-home-btn").addEventListener("click", navigateToLanding);
  document.querySelector("#clear-saved-btn").addEventListener("click", () => {
    clearSaved();
    toast(t("savedDataCleared") || "Dados salvos apagados.", "success");
    renderConnect({}, navigateToLanding, navigateToDashboard);
  });

  document.querySelector("#connect-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config = {
      username: String(form.get("username") || "").trim(),
      token: String(form.get("token") || "").trim(),
      owner: String(form.get("owner") || "").trim(),
      repo: String(form.get("repo") || "").trim(),
      branch: String(form.get("branch") || "main").trim(),
      jsonPath: githubPath.stripSlashes(String(form.get("jsonPath") || "")),
      imgchestToken: String(form.get("imgchestToken") || "").trim(),
    };

    try {
      setBusy(true);
      state.config = config;
      const client = ensureClient();
      const validation = await validateConnection(client, config);
      saveConfig(config, Boolean(form.get("rememberToken")), Boolean(form.get("rememberImgchestToken")));

      if (validation.pathReady) {
        toast(t("connectedRepo") || "Conectado ao repositório.", "success");
      } else {
        toast(label(
          "Conectado. A pasta configurada ainda não existe ou está vazia; você poderá criar um novo mangá.",
          "Connected. The configured folder does not exist yet or is empty; you can create a new manga.",
        ), "warning");
      }

      navigateToDashboard();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
}
