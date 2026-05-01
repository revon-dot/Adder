import { renderLanding } from "./views/landing.js";
import { renderConnect } from "./views/connect.js";
import { renderDashboard, loadDashboard } from "./views/dashboard.js";
import { openEditor } from "./views/editor.js";
import { loadSavedLanguage, saveLanguage } from "./i18n.js";

function navigateToLanding() {
  renderLanding(navigateToConnect);
}

function navigateToConnect(prefill = {}) {
  renderConnect(prefill, navigateToLanding, navigateToDashboard);
}

function navigateToDashboard() {
  loadDashboard(() => renderDashboard(navigateToEditor, navigateToConnect), navigateToConnect, navigateToEditor);
}

function navigateToEditor(file) {
  openEditor(file, navigateToDashboard);
}

// Initial render
try {
  saveLanguage(loadSavedLanguage());
  navigateToLanding();
} catch (error) {
  console.error("Error during initial render:", error);
  const appDiv = document.getElementById('app');
  if (appDiv) {
    appDiv.innerHTML = `<div class='error-box'>Ocorreu um erro ao carregar a página. Verifique o console para mais detalhes.</div>`;
  }
}
