import { showStoreDirectly, startIntro } from "./app";
import { getCatalog } from "./firebase";

const desktopGif = "/assets/intro/desktop.gif";
const mobileGif = "/assets/intro/mobile.gif";
const inviteLink = document.querySelector<HTMLAnchorElement>("#whatsapp-invite");
const enterStoreButton = document.querySelector<HTMLButtonElement>("#enter-store");
const skipIntroButton = document.querySelector<HTMLButtonElement>("#skip-intro");
const introError = document.querySelector<HTMLElement>("#intro-error");
let entrySettings = {
  entryScreenEnabled: true,
  introAnimationEnabled: true,
};

inviteLink.addEventListener("click", () => {
  document.querySelector("#welcome-root").hidden = true;
  document.querySelector("#entry-preview").hidden = false;
});

enterStoreButton.addEventListener("click", () => {
  enterStoreButton.disabled = true;
  const transition = entrySettings.introAnimationEnabled
    ? startIntro({ desktopGif, mobileGif })
    : showStoreDirectly();
  transition.catch((error) => {
    console.error("A animação de entrada não pôde ser iniciada:", error);
    introError.textContent =
      "Não foi possível carregar a animação. Tente novamente para entrar na loja.";
    introError.hidden = false;
    enterStoreButton.disabled = false;
  });
});

skipIntroButton.addEventListener("click", () => {
  skipIntroButton.disabled = true;
  showStoreDirectly().catch((error) => {
    console.error("A loja não pôde ser aberta diretamente:", error);
    introError.textContent =
      "Não foi possível abrir a loja agora. Verifique a conexão e tente novamente.";
    introError.hidden = false;
    skipIntroButton.disabled = false;
  });
});

function loadShader() {
  import("./shader")
    .then(({ mountShader }) => mountShader())
    .catch((error) => {
      console.error("O fundo animado não pôde ser carregado:", error);
    });
}

function scheduleShader() {
  const requestIdleCallback = (
    window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    }
  ).requestIdleCallback;
  if (requestIdleCallback) {
    requestIdleCallback(loadShader, { timeout: 1200 });
  } else {
    window.setTimeout(loadShader, 0);
  }
}

getCatalog()
  .then((catalog) => {
    const settings = catalog?.settings;
    entrySettings = {
      entryScreenEnabled: settings?.entryScreenEnabled !== false,
      introAnimationEnabled: settings?.introAnimationEnabled !== false,
    };
    if (entrySettings.entryScreenEnabled) scheduleShader();
    if (!entrySettings.entryScreenEnabled) {
      return showStoreDirectly();
    }
    if (!entrySettings.introAnimationEnabled) {
      enterStoreButton.textContent = "Entrar na loja";
    }
    return undefined;
  })
  .catch((error) => {
    console.error("As configurações de entrada não puderam ser carregadas:", error);
    scheduleShader();
  });
