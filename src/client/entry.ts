import { showStoreDirectly, startIntro } from "./app";
import { getCatalog } from "./firebase";

const desktopGif = "/assets/intro/desktop.gif";
const mobileGif = "/assets/intro/mobile.gif";
const inviteLink = document.querySelector<HTMLAnchorElement>("#whatsapp-invite");
const enterStoreButton = document.querySelector<HTMLButtonElement>("#enter-store");
const skipIntroButton = document.querySelector<HTMLButtonElement>("#skip-intro");
const introError = document.querySelector<HTMLElement>("#intro-error");
const promoCodeButton = document.querySelector<HTMLButtonElement>("#promo-code");
const promoFeedback = document.querySelector<HTMLElement>("#promo-feedback");
let promoFeedbackTimeout;
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

promoCodeButton.addEventListener("click", async () => {
  const promoCode = promoCodeButton.dataset.code || "REHVA10";
  const promoPercent = Number(promoCodeButton.dataset.percent || 10);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(promoCode);
    } else {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = promoCode;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.append(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand("copy");
      temporaryInput.remove();
      if (!copied) throw new Error("A cópia não foi autorizada pelo navegador.");
    }

    promoFeedback.textContent =
      `Cupom ${promoCode} copiado! Aproveite ${promoPercent}% OFF.`;
  } catch (error) {
    console.error("Não foi possível copiar o cupom:", error);
    promoFeedback.textContent = "Não foi possível copiar. Seu código é REHVA10.";
  }

  promoCodeButton.classList.add("is-copied");
  window.clearTimeout(promoFeedbackTimeout);
  promoFeedbackTimeout = window.setTimeout(() => {
    promoFeedback.textContent = "";
    promoCodeButton.classList.remove("is-copied");
  }, 2600);
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
