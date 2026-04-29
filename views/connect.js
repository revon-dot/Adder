import { state } from "../state.js";
import { saveConfig, clearSaved, getSavedImgChestToken } from "../state.js";
import { render, setBusy, toast, errorMessage } from "../ui.js";
import { githubPath } from "../github.js";
import { ensureClient } from "../repo.js";
import { renderConnectPage } from "./connect-page.js";

export function renderConnect(prefill = {}, navigateToLanding, navigateToDashboard) {
  const imgchestToken = prefill.imgchestToken || getSavedImgChestToken();
  render(renderConnectPage(prefill, imgchestToken));

  document.querySelector("#back-home-btn").addEventListener("click", navigateToLanding);
  document.querySelector("#clear-saved-btn").addEventListener("click", () => {
    clearSaved();
    toast("Dados salvos apagados.", "success");
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
      await client.getRepo(config);
      saveConfig(config, Boolean(form.get("rememberToken")), Boolean(form.get("rememberImgchestToken")));
      toast("Conectado ao repositório.", "success");
      navigateToDashboard();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  });
}
