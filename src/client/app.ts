import { mountProductCards } from "./product-cards";
import "../styles/store.css";

const INTRO_DURATION_MS = {
  desktop: 8000,
  mobile: 7940,
};
export async function startIntro({ desktopGif, mobileGif }) {
  const welcome = document.querySelector("#welcome-root");
  const entryPreview = document.querySelector("#entry-preview");
  const animationScreen = document.querySelector("#intro-animation");
  const introGif = document.querySelector<HTMLImageElement>("#intro-gif");
  const store = document.querySelector("#store");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    welcome.hidden = true;
    entryPreview.hidden = true;
    await showStoreDirectly();
    return;
  }

  const isMobile = window.matchMedia("(max-width: 700px)").matches;
  const selectedGif = isMobile ? mobileGif : desktopGif;
  const introDuration = isMobile
    ? INTRO_DURATION_MS.mobile
    : INTRO_DURATION_MS.desktop;

  try {
    await new Promise((resolve, reject) => {
      introGif.onload = resolve;
      introGif.onerror = () =>
        reject(new Error("O arquivo da animação não pôde ser carregado."));
      introGif.src = selectedGif;
    });
    welcome.hidden = true;
    entryPreview.hidden = true;
    animationScreen.hidden = false;
    await new Promise((resolve) => window.setTimeout(resolve, introDuration));
    await showStoreDirectly();
  } catch (error) {
    animationScreen.hidden = true;
    entryPreview.hidden = false;
    throw error;
  }
}

export async function showStoreDirectly() {
  const welcome = document.querySelector("#welcome-root");
  const entryPreview = document.querySelector("#entry-preview");
  const animationScreen = document.querySelector("#intro-animation");
  const store = document.querySelector("#store");

  await mountProductCards(document.querySelector("#product-grid"));
  welcome.hidden = true;
  entryPreview.hidden = true;
  animationScreen.hidden = true;
  store.hidden = false;
  document.querySelector("#store-title").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
