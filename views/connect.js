import { getSavedImgChestToken } from "../state.js";
import { render } from "../ui.js";
import { renderConnectPage } from "./connect-page.js";
import { bindConnectEvents } from "./connect-events.js";

export function renderConnect(prefill = {}, navigateToLanding, navigateToDashboard) {
  const imgchestToken = prefill.imgchestToken || getSavedImgChestToken();
  render(renderConnectPage(prefill, imgchestToken));
  bindConnectEvents({
    navigateToLanding,
    navigateToDashboard,
    renderConnect,
  });
}
