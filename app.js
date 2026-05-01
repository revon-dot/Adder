import { renderLanding } from "./views/landing.js";
import { renderConnect } from "./views/connect.js";
import { renderDashboard, loadDashboard } from "./views/dashboard.js";
import { openEditor } from "./views/editor.js";
import { loadSavedLanguage, saveLanguage } from "./i18n.js";

const guardedUploadFormIds = new Set([
  "github-image-upload-form",
  "github-folder-upload-form",
]);

const uploadImageAccept = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

function normalizeUploadFileInputs(root = document) {
  root.querySelectorAll?.("#github-image-upload-form input[type='file'], #github-folder-upload-form input[type='file']").forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.setAttribute("accept", uploadImageAccept);
    }
  });
}

function installUploadFileInputNormalizer() {
  normalizeUploadFileInputs();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          normalizeUploadFileInputs(node);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function installDuplicateSubmitGuard() {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!guardedUploadFormIds.has(form.id)) return;

    if (form.dataset.uploading === "true") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    form.dataset.uploading = "true";

    const submitButton = form.querySelector("button[type='submit']");
    const resetIfNotBusy = () => {
      if (!form.isConnected) return;
      if (!submitButton?.disabled) form.dataset.uploading = "false";
    };

    setTimeout(resetIfNotBusy, 0);

    const observer = new MutationObserver(() => {
      if (!form.isConnected) {
        observer.disconnect();
        return;
      }

      if (!submitButton?.disabled) {
        form.dataset.uploading = "false";
        observer.disconnect();
      }
    });

    if (submitButton) {
      observer.observe(submitButton, {
        attributes: true,
        attributeFilter: ["disabled"],
      });
    }
  }, true);
}

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
  installDuplicateSubmitGuard();
  installUploadFileInputNormalizer();
  saveLanguage(loadSavedLanguage());
  navigateToLanding();
} catch (error) {
  console.error("Error during initial render:", error);
  const appDiv = document.getElementById('app');
  if (appDiv) {
    appDiv.innerHTML = `<div class='error-box'>Ocorreu um erro ao carregar a página. Verifique o console para mais detalhes.</div>`;
  }
}
