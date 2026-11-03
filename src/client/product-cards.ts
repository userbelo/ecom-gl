// @ts-nocheck
import { getCatalog, watchCatalog } from "./firebase";
import { sanitizeProductDescription } from "./rich-description";

let products = [
  {
    id: "rehva-look-1",
    name: "Look REHVA 01",
    priceCents: 12990,
    variants: [
      {
        label: "Rosa",
        color: "#ed70ae",
        first:
          new URL("/assets/catalog/SaveClip.App_763137016_18119798522489486_6651549999609317427_n.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/3cdb1b7752add0d3e4f0d4b63800d656.jpg", import.meta.url).href,
      },
      {
        label: "Lilás",
        color: "#a88bd4",
        first:
          new URL("/assets/catalog/f9c457376f6530f756765863fdaaeb72.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/f893e58829e60e042300e9d3832ebf11.jpg", import.meta.url).href,
      },
      {
        label: "Pink",
        color: "#f20b83",
        first:
          new URL("/assets/catalog/f9014afad6fb6b14302e6d1c91457855.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/SaveClip.App_826046770_18127507136489486_7800219321545072559_n.jpg", import.meta.url).href,
      },
    ],
  },
  {
    id: "rehva-look-2",
    name: "Look REHVA 02",
    priceCents: 9780,
    variants: [
      {
        label: "Rosa",
        color: "#ed70ae",
        first:
          new URL("/assets/catalog/61uRMmyaedL._AC_SL1500_.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/f9599a12afb1a5a5d705548594d6d164.jpg", import.meta.url).href,
      },
      {
        label: "Lilás",
        color: "#a88bd4",
        first:
          new URL("/assets/catalog/7464b5ed5ea1b009d04bf84be169e7d2.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/watermarked_img_4311645796307961767.jpg", import.meta.url).href,
      },
      {
        label: "Pink",
        color: "#f20b83",
        first:
          new URL("/assets/catalog/watermarked_img_4663206965466206582.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/PHOTO UGC.jpg", import.meta.url).href,
      },
    ],
  },
  {
    id: "rehva-look-3",
    name: "Look REHVA 03",
    priceCents: 11900,
    variants: [
      {
        label: "Rosa",
        color: "#ed70ae",
        first:
          new URL("/assets/catalog/2347a6f10a7f0576a200dc0a3cdcbd4f.jpg", import.meta.url).href,
        second: new URL("/assets/catalog/VIDEO.jpg", import.meta.url).href,
      },
      {
        label: "Lilás",
        color: "#a88bd4",
        first:
          new URL("/assets/catalog/5faebd36-7ff6-4bfe-8a8d-0a3a76b4b40a.jfif", import.meta.url).href,
        second:
          new URL("/assets/catalog/watermarked_img_342567647017571808.jpg", import.meta.url).href,
      },
      {
        label: "Pink",
        color: "#f20b83",
        first:
          new URL("/assets/catalog/f9599a12afb1a5a5d705548594d6d164.jpg", import.meta.url).href,
        second:
          new URL("/assets/catalog/61uRMmyaedL._AC_SL1500_.jpg", import.meta.url).href,
      },
    ],
  },
];
let categories = [];
let productDetailsVisible = false;
let productDetailsReturnScrollY = null;
const cartItems = new Map();
let cartInitialized = false;
const CART_STORAGE_KEY = "rehva-cart-v1";
const KIT_STORAGE_KEY = "rehva-kit-v1";
const KIT_TIER_STORAGE_KEY = "rehva-kit-tier-v1";
const kitItems = new Map();
let kitItemsRestored = false;
let kitBuilderSettings;
let selectedKitTierMinItems = 2;
let storeCouponSettings = {
  firstPurchaseCode: "REHVA5",
  firstPurchasePercent: 5,
  repeatPurchasePercent: 10,
};
let activeCategoryId = "all";
let categoryCarouselTimer;
let comboCarouselTimer;

function normalizeProduct(product) {
  return {
    ...product,
    reviewRating:
      Number.isFinite(product.reviewRating) ? product.reviewRating : 4.5,
    reviewCount:
      Number.isSafeInteger(product.reviewCount) && product.reviewCount >= 0
        ? product.reviewCount
        : 0,
    variants: product.variants.map((variant) => ({
      ...variant,
      first: variant.images[0],
      second: variant.images[1] ?? variant.images[0],
    })),
  };
}

function getProductVariant(product, cartItem) {
  return (
    product.variants.find((variant) => variant.id === cartItem.variantId) ??
    product.variants[cartItem.variantIndex] ??
    product.variants[0]
  );
}

function findCheckoutLink(
  product,
  variantId,
  selectedSize,
) {
  if (product.sizeChart && !selectedSize) return null;
  return (
    product.checkoutLinks?.find(
      (entry) =>
        entry.variantId === variantId &&
        (entry.size ?? null) === (selectedSize ?? null) &&
        (entry.kitTierMinItems ?? null) === null,
    )?.url ?? null
  );
}

function createYampiCartCheckoutUrl(entries) {
  if (!entries.length) throw new Error("Sua sacola está vazia.");
  let checkoutOrigin = null;
  const itemsByToken = new Map();

  for (const item of entries) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Informe quantidades inteiras maiores que zero.");
    }
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find(
      (entry) => entry.id === item.variantId,
    );
    if (!product || !variant) {
      throw new Error("Um produto ou uma opção da sacola não está mais disponível.");
    }
    const checkoutLink = findCheckoutLink(product, variant.id, item.size);
    if (!checkoutLink) {
      throw new Error(
        `Não há link Yampi para ${product.name} (${variant.label}${item.size ? `, ${item.size}` : ""}).`,
      );
    }

    let purchaseUrl;
    try {
      purchaseUrl = new URL(checkoutLink);
    } catch {
      throw new Error(`O link Yampi de ${product.name} é inválido.`);
    }
    if (
      purchaseUrl.protocol !== "https:" ||
      !/\.pay\.yampi\.com\.br$/i.test(purchaseUrl.hostname) ||
      purchaseUrl.username ||
      purchaseUrl.password ||
      purchaseUrl.port ||
      !/^\/r\/[a-z0-9]+$/i.test(purchaseUrl.pathname) ||
      purchaseUrl.search ||
      purchaseUrl.hash
    ) {
      throw new Error(`O link Yampi de ${product.name} é inválido.`);
    }
    if (checkoutOrigin && checkoutOrigin !== purchaseUrl.origin) {
      throw new Error("Os links precisam pertencer à mesma loja Yampi.");
    }
    checkoutOrigin = purchaseUrl.origin;

    const token = purchaseUrl.pathname.slice("/r/".length);
    const totalQuantity = (itemsByToken.get(token) ?? 0) + item.quantity;
    if (!Number.isSafeInteger(totalQuantity)) {
      throw new Error("A quantidade total de um produto excede o limite permitido.");
    }
    itemsByToken.set(token, totalQuantity);
  }

  const combinedProducts = [...itemsByToken]
    .map(([token, quantity]) => `${token}:${quantity}`)
    .join(",");
  return new URL(`${checkoutOrigin}/r/${combinedProducts}`).href;
}

function getYampiCheckoutUrl(product, variantId, size, quantity = 1) {
  return createYampiCartCheckoutUrl([
    { productId: product.id, variantId, size, quantity },
  ]);
}

function getCurrentPriceCents(product) {
  return product.promotionalPriceCents ?? product.priceCents;
}

function createPriceDisplay(product, className) {
  const display = createElement("div", `${className}-group`);
  if (product.promotionalPriceCents != null) {
    const discount = Math.round(
      (1 - product.promotionalPriceCents / product.priceCents) * 100,
    );
    display.append(
      createElement(
        "del",
        `${className}-original`,
        formatPrice(product.priceCents),
      ),
      createElement("span", `${className}-discount`, `${discount}% OFF`),
    );
  }
  display.append(
    createElement(
      "strong",
      className,
      formatPrice(getCurrentPriceCents(product)),
    ),
  );
  return display;
}

function getDescriptionText(description) {
  const template = document.createElement("template");
  template.innerHTML = String(description || "");
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

function getDescriptionSummary(description, maxLength = 72) {
  const text = getDescriptionText(description);
  return text.length > maxLength
    ? `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}…`
    : text;
}

function createRecommendations(product) {
  const recommendations = products.filter(
    (candidate) =>
      candidate.id !== product.id &&
      candidate.categoryId === product.categoryId &&
      product.recommendedProductIds?.includes(candidate.id),
  );
  if (!recommendations.length) return null;
  const section = createElement("section", "product-recommendations");
  const heading = createElement(
    "h2",
    "product-recommendations__heading",
    "Você também pode gostar",
  );
  const grid = createElement("div", "product-recommendations__grid");
  recommendations.forEach((candidate, index) => {
    grid.append(createProductCard(candidate, index));
  });
  section.append(heading, grid);
  return section;
}

function updateMobilePurchaseBar(
  product,
  quantity,
  purchaseAvailable,
  onAction,
  purchaseLabel,
  selectionSummary,
) {
  let bar = document.querySelector("#mobile-purchase-bar");
  if (!bar) {
    bar = createElement("div", "mobile-purchase-bar");
    bar.id = "mobile-purchase-bar";
    bar.setAttribute("aria-label", "Compra rápida");
    document.body.append(bar);
  }

  const summary = createElement("div", "mobile-purchase-bar__summary");
  summary.append(createPriceDisplay(product, "mobile-purchase-bar__price"));
  summary.append(
    createElement("span", "mobile-purchase-bar__size", selectionSummary),
  );
  const action = createElement(
    "button",
    "mobile-purchase-bar__action",
    purchaseAvailable ? "COMPRAR AGORA ↗" : purchaseLabel,
  );
  action.type = "button";
  action.disabled =
    !purchaseAvailable &&
    !["ESCOLHA A COR", "ESCOLHA O TAMANHO"].includes(purchaseLabel);
  action.setAttribute(
    "aria-label",
    purchaseAvailable
      ? `Comprar ${quantity} unidade(s) de ${product.name} na Yampi`
      : `${purchaseLabel} para comprar ${product.name}`,
  );
  action.addEventListener("click", onAction);
  bar.replaceChildren(summary, action);
  bar.hidden = false;
  document.body.classList.add("has-mobile-purchase-bar");
}

function applyStoreSettings(settings) {
  kitBuilderSettings = getKitBuilderConfig(settings);
  const kitNavigationLink = document.querySelector(
    '.main-navigation a[href="#kits"]',
  );
  if (kitNavigationLink) {
    kitNavigationLink.hidden = !kitBuilderSettings.enabled;
  }
  document.querySelector("#announcement-primary").textContent =
    settings.announcement;
  document.querySelector("#announcement-secondary").textContent =
    settings.announcementSecondary;
  document.querySelector("#hero-eyebrow").textContent = settings.heroEyebrow;
  document.querySelector("#hero-title-line-1").textContent =
    settings.heroTitleLine1;
  document.querySelector("#hero-title-line-2").textContent =
    settings.heroTitleLine2;
  document.querySelector("#hero-description").textContent =
    settings.heroDescription;
  const heroImage = document.querySelector("#hero-image");
  heroImage.src = settings.heroImage;
  heroImage.alt = `Capa e imagem da loja ${settings.storeName}`;

  storeCouponSettings = {
    firstPurchaseCode: settings.firstPurchaseCouponCode || "REHVA5",
    firstPurchasePercent: settings.firstPurchaseCouponPercent ?? 5,
    repeatPurchasePercent: settings.repeatPurchaseCouponPercent ?? 10,
  };
}

const formatPrice = (priceCents) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100);

function addToCart(product, variantIndex, selectedSize = null, quantity = 1) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error("Informe uma quantidade inteira maior que zero.");
  }
  const variant = product.variants[variantIndex];
  const key = `${product.id}:${variant.id}:${selectedSize ?? ""}`;
  const existingItem = cartItems.get(key);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cartItems.set(key, {
      productId: product.id,
      variantId: variant.id,
      variantIndex,
      size: selectedSize,
      quantity,
    });
  }
  persistCart();
  renderCart();
  const feedback = document.querySelector("#cart-feedback");
  if (feedback) {
    const sizeLabel = selectedSize ? `, tamanho ${selectedSize}` : "";
    feedback.textContent = `${quantity} unidade(s) de ${product.name}, opção ${variant.label}${sizeLabel}, adicionada(s) à sacola.`;
  }
  openCart();
}

function changeCartQuantity(key, change) {
  const item = cartItems.get(key);
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) cartItems.delete(key);
  persistCart();
  renderCart();
}

function removeFromCart(key) {
  cartItems.delete(key);
  persistCart();
  renderCart();
}

function persistCart() {
  try {
    sessionStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([...cartItems.values()]),
    );
  } catch (error) {
    console.error("Não foi possível manter a sacola nesta sessão:", error);
  }
}

function restoreCart() {
  try {
    const savedCart = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!savedCart) return;

    const entries = JSON.parse(savedCart);
    if (!Array.isArray(entries)) {
      throw new Error("O conteúdo salvo da sacola não tem o formato esperado.");
    }

    entries.forEach((item) => {
      if (!item || typeof item !== "object") {
        console.error("Um item inválido foi ignorado ao restaurar a sacola.");
        return;
      }
      const product = products.find((entry) => entry.id === item.productId);
      const variantIndex = product?.variants.findIndex(
        (variant) => variant.id === item.variantId,
      );
      const savedVariantIndex =
        variantIndex >= 0 ? variantIndex : item.variantIndex;
      const savedSize =
        typeof item.size === "string" && item.size
          ? item.size
          : null;
      const validSize =
        !product?.sizeChart ||
        product.sizeChart.some((size) => size.size === savedSize);
      if (
        !product ||
        !Number.isInteger(savedVariantIndex) ||
        !product.variants[savedVariantIndex] ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        !validSize
      ) {
        console.error("Um item inválido foi ignorado ao restaurar a sacola.");
        return;
      }
      const variant = product.variants[savedVariantIndex];
      const key = `${item.productId}:${variant.id}:${savedSize ?? ""}`;
      const existingItem = cartItems.get(key);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        cartItems.set(key, {
          productId: item.productId,
          variantId: variant.id,
          variantIndex: savedVariantIndex,
          size: savedSize,
          quantity: item.quantity,
        });
      }
    });
  } catch (error) {
    console.error("Não foi possível restaurar a sacola desta sessão:", error);
    try {
      sessionStorage.removeItem(CART_STORAGE_KEY);
    } catch (storageError) {
      console.error("Não foi possível limpar os dados inválidos da sacola:", storageError);
    }
  }
}

function renderCart() {
  const count = document.querySelector("#cart-count");
  const itemsRoot = document.querySelector("#cart-items");
  const totalRoot = document.querySelector("#cart-total");
  const summary = document.querySelector("#cart-summary");
  const summaryRows = document.querySelector("#cart-summary-rows");
  const savings = document.querySelector("#cart-savings");
  const notice = document.querySelector("#cart-notice");
  const checkout = document.querySelector("#cart-checkout");
  const checkoutNote = document.querySelector("#cart-checkout-note");
  const progress = document.querySelector("#cart-kit-progress");
  const progressTitle = document.querySelector("#cart-kit-progress-title");
  const progressCopy = document.querySelector("#cart-kit-progress-copy");
  const progressDiscount = document.querySelector("#cart-kit-progress-discount");
  const progressTrack = document.querySelector("#cart-kit-progress-track");
  const progressFill = document.querySelector("#cart-kit-progress-fill");
  const kitCta = document.querySelector("#cart-kit-cta");
  const kitCtaTitle = kitCta?.querySelector("strong");
  if (
    !count ||
    !itemsRoot ||
    !totalRoot ||
    !summary ||
    !summaryRows ||
    !savings ||
    !notice ||
    !checkout ||
    !checkoutNote ||
    !progress ||
    !progressTitle ||
    !progressCopy ||
    !progressDiscount ||
    !progressTrack ||
    !progressFill ||
    !kitCta
  ) {
    return;
  }

  const entries = [...cartItems.entries()];
  document
    .querySelector("#cart-dialog")
    ?.classList.toggle("is-empty", entries.length === 0);
  const quantity = entries.reduce((sum, [, item]) => sum + item.quantity, 0);
  const subtotal = entries.reduce((sum, [, item]) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + (product ? getCurrentPriceCents(product) : 0) * item.quantity;
  }, 0);
  const activeTier = quantity >= 2 ? getKitTierForQuantity(quantity) : null;
  const kitSavings = activeTier
    ? entries.reduce((sum, [, item]) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return sum;
        const unitPrice = getCurrentPriceCents(product);
        const discountedUnitPrice = getKitUnitPriceCents(product, activeTier);
        return sum + (unitPrice - discountedUnitPrice) * item.quantity;
      }, 0)
    : 0;
  const estimatedTotal = subtotal - kitSavings;
  count.textContent = String(quantity);
  count.setAttribute("aria-label", `${quantity} ${quantity === 1 ? "item" : "itens"}`);
  itemsRoot.replaceChildren();

  if (entries.length === 0) {
    itemsRoot.append(
      createElement(
        "p",
        "cart-dialog__empty",
        "Sua sacola está vazia. Escolha suas peças para ver seu desconto por quantidade.",
      ),
    );
  }

  const nextTier =
    quantity < 2
      ? getKitTier(2)
      : quantity < 3
        ? getKitTier(3)
        : quantity < 4
          ? getKitTier(4)
          : null;
  const progressTarget = nextTier?.minItems ?? 4;
  const progressPercent = Math.min(100, Math.round((quantity / progressTarget) * 100));
  progress.hidden = false;
  progressTitle.textContent =
    activeTier && !nextTier
      ? "KIT PERSONALIZADO ATIVO!"
      : activeTier
        ? `${activeTier.discountPercent}% OFF LIBERADOS`
        : "DESCONTO DE KIT DISPONÍVEL";
  progressCopy.textContent =
    activeTier && !nextTier
      ? `Você combinou ${quantity} peças e liberou ${activeTier.discountPercent}% de desconto.`
      : activeTier
        ? `Adicione mais ${progressTarget - quantity} peça${progressTarget - quantity === 1 ? "" : "s"} para liberar ${nextTier.discountPercent}% OFF.`
        : `Adicione ${progressTarget - quantity} peça${progressTarget - quantity === 1 ? "" : "s"} e ganhe ${getKitTier(2).discountPercent}% OFF no kit.`;
  progressDiscount.textContent = activeTier
    ? `${activeTier.discountPercent}% OFF`
    : `${getKitTier(2).discountPercent}% OFF`;
  progressFill.style.width = `${progressPercent}%`;
  progressTrack.setAttribute("aria-valuenow", String(progressPercent));
  kitCta.hidden = false;
  if (kitCtaTitle) {
    kitCtaTitle.textContent = `LEVE 2 PEÇAS E GANHE ${getKitTier(2).discountPercent}% OFF`;
  }

  for (const [key, item] of entries) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) continue;
    const variant = getProductVariant(product, item);
    const row = createElement("article", "cart-item");
    const image = document.createElement("img");
    image.className = "cart-item__image";
    image.src = variant.first;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";

    const info = createElement("div", "cart-item__info");
    const name = createElement("h3", "cart-item__name", product.name);
    const variantLabel = createElement(
      "p",
      "cart-item__variant",
      `Opção: ${variant.label}`,
    );
    if (item.size) {
      variantLabel.textContent += ` · Tamanho: ${item.size}`;
    }
    const price = createPriceDisplay(product, "cart-item__price");
    const lineTotal = createElement(
      "p",
      `cart-item__line-total${activeTier ? " cart-item__line-total--discount" : ""}`,
      activeTier
        ? `${formatPrice(getKitUnitPriceCents(product, activeTier) * item.quantity)} estimado com ${activeTier.discountPercent}% OFF`
        : `${formatPrice(getCurrentPriceCents(product) * item.quantity)} no total`,
    );
    const controls = createElement("div", "cart-item__controls");
    const decrease = createElement("button", "cart-item__quantity", "−");
    decrease.type = "button";
    decrease.setAttribute("aria-label", `Diminuir quantidade de ${product.name}`);
    decrease.addEventListener("click", () => changeCartQuantity(key, -1));
    const quantityLabel = createElement(
      "span",
      "cart-item__quantity-value",
      String(item.quantity),
    );
    const increase = createElement("button", "cart-item__quantity", "+");
    increase.type = "button";
    increase.setAttribute("aria-label", `Aumentar quantidade de ${product.name}`);
    increase.addEventListener("click", () => changeCartQuantity(key, 1));
    const remove = createElement("button", "cart-item__remove", "REMOVER");
    remove.type = "button";
    remove.addEventListener("click", () => removeFromCart(key));
    controls.append(decrease, quantityLabel, increase, remove);
    info.append(name, variantLabel, price, lineTotal, controls);
    row.append(image, info);
    itemsRoot.append(row);
  }

  const checkoutAvailable =
    entries.length > 0 &&
    entries.every(([, item]) => {
      const product = products.find((entry) => entry.id === item.productId);
      return Boolean(
        product &&
          product.variants.some((variant) => variant.id === item.variantId) &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          findCheckoutLink(product, item.variantId, item.size),
      );
    });

  summary.hidden = false;
  summaryRows.replaceChildren();
  const addSummaryRow = (label, amount, className = "") => {
    const row = createElement(
      "div",
      `cart-dialog__summary-row${className ? ` ${className}` : ""}`,
    );
    row.append(
      createElement("span", "", label),
      createElement("strong", "", amount),
    );
    summaryRows.append(row);
  };
  addSummaryRow("Subtotal", formatPrice(subtotal));
  if (activeTier) {
    addSummaryRow(
      `Desconto estimado do kit (${activeTier.discountPercent}%)`,
      `− ${formatPrice(kitSavings)}`,
      "cart-dialog__summary-row--discount",
    );
    savings.textContent = `Você economiza ${formatPrice(kitSavings)} nesta compra! O desconto do kit não acumula com o cupom de primeira compra.`;
  } else {
    const remaining = Math.max(0, 2 - quantity);
    addSummaryRow(
      `Desconto do kit (${getKitTier(2).discountPercent}%)`,
      quantity === 0
        ? "Monte um kit para ativar"
        : `Adicione mais ${remaining} peça${remaining === 1 ? "" : "s"}`,
      "cart-dialog__summary-row--discount",
    );
    savings.textContent =
      quantity === 0
        ? `Frete grátis em todos os pedidos. Adicione 2 peças para ganhar ${getKitTier(2).discountPercent}% OFF.`
        : `Seu frete é grátis! Adicione mais ${remaining} peça${remaining === 1 ? "" : "s"} para liberar ${getKitTier(2).discountPercent}% OFF.`;
  }
  totalRoot.textContent = formatPrice(estimatedTotal);

  if (checkoutAvailable) {
    checkout.disabled = false;
    checkout.hidden = false;
    checkoutNote.hidden = false;
    checkoutNote.textContent = activeTier
      ? `A Yampi confirma o desconto de ${activeTier.discountPercent}% no checkout. Ele não acumula com o cupom de primeira compra; o frete é grátis.`
      : `Adicione mais 1 peça para liberar ${getKitTier(2).discountPercent}% OFF. Frete grátis em todos os pedidos.`;
    notice.textContent = "";
  } else {
    checkout.disabled = true;
    checkout.hidden = true;
    checkoutNote.hidden = quantity === 0;
    if (quantity === 0) {
      checkoutNote.textContent =
        "Frete grátis em todos os pedidos. O desconto do kit não acumula com o cupom de primeira compra.";
    }
    notice.textContent = entries.length
      ? "Há uma combinação sem link de checkout cadastrado."
      : "";
  }
}

function initializeCart() {
  if (cartInitialized) return;
  const dialog = document.querySelector("#cart-dialog");
  const trigger = document.querySelector("#cart-trigger");
  const close = document.querySelector("#cart-close");
  const kitLink = document.querySelector("#cart-kit-link");
  if (!dialog || !trigger || !close) return;

  const checkout = document.querySelector("#cart-checkout");
  checkout.addEventListener("click", () => {
    const entries = [...cartItems.values()];
    if (!entries.length) return;

    checkout.disabled = true;
    checkout.setAttribute("aria-busy", "true");
    const notice = document.querySelector("#cart-notice");
    try {
      window.location.assign(createYampiCartCheckoutUrl(entries));
    } catch (error) {
      console.error("Não foi possível iniciar o checkout da sacola:", error);
      notice.textContent = error.message;
    } finally {
      checkout.disabled = false;
      checkout.removeAttribute("aria-busy");
    }
  });

  trigger.addEventListener("click", openCart);
  kitLink?.addEventListener("click", () => dialog.close());
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  cartInitialized = true;
  restoreCart();
  renderCart();
}

function openCart() {
  const dialog = document.querySelector("#cart-dialog");
  if (!dialog) return;
  renderCart();
  if (!dialog.open) dialog.showModal();
}

function createProductCard(product, productIndex) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.setAttribute("role", "listitem");
  card.dataset.productId = product.id;
  card.dataset.categoryId = product.categoryId;

  const media = document.createElement("button");
  media.type = "button";
  media.className = "product-card__media";
  media.setAttribute("aria-label", `Ver detalhes de ${product.name}`);

  const primaryImage = document.createElement("img");
  primaryImage.className = "product-card__image is-visible";
  primaryImage.alt = `Imagem do produto ${productIndex + 1}, vista principal`;
  primaryImage.src = product.variants[0].first;
  primaryImage.loading = productIndex === 0 ? "eager" : "lazy";
  primaryImage.decoding = "async";

  const secondaryImage = document.createElement("img");
  secondaryImage.className = "product-card__image";
  secondaryImage.alt = `Imagem do produto ${productIndex + 1}, vista alternativa`;
  secondaryImage.src = product.variants[0].second;
  secondaryImage.loading = "lazy";
  secondaryImage.decoding = "async";

  media.append(primaryImage, secondaryImage);

  const swatches = document.createElement("div");
  swatches.className = "product-card__swatches";
  swatches.setAttribute("role", "group");
  swatches.setAttribute("aria-label", `Opções de cor do produto ${productIndex + 1}`);
  card.dataset.activeVariant = "0";
  card.dataset.variantSelected = String(product.variants.length === 1);
  const hasMultipleVariants = product.variants.length > 1;

  product.variants.forEach((variant, variantIndex) => {
    const swatch = document.createElement("button");
    swatch.className = "product-card__swatch";
    swatch.type = "button";
    swatch.style.setProperty("--swatch-color", variant.color);
    swatch.setAttribute("aria-label", `${variant.label}, produto ${productIndex + 1}`);
    swatch.setAttribute(
      "aria-pressed",
      String(variantIndex === 0 && !hasMultipleVariants),
    );
    swatch.title = variant.label;

    const selectVariant = () => {
      card.dataset.variantSelected = "true";
      product.variants.forEach((item, index) => {
        const button = swatches.children[index];
        button.setAttribute("aria-pressed", index === variantIndex ? "true" : "false");
      });
      primaryImage.src = variant.first;
      secondaryImage.src = variant.second;
      primaryImage.classList.add("is-visible");
      secondaryImage.classList.remove("is-visible");
      card.dataset.activeImage = "0";
      card.dataset.activeVariant = String(variantIndex);
    };

    swatch.addEventListener("click", selectVariant);
    swatches.append(swatch);
  });

  const showAlternateImage = () => {
    secondaryImage.classList.add("is-visible");
    primaryImage.classList.remove("is-visible");
    card.dataset.activeImage = "1";
  };
  const showPrimaryImage = () => {
    primaryImage.classList.add("is-visible");
    secondaryImage.classList.remove("is-visible");
    card.dataset.activeImage = "0";
  };

  media.addEventListener("pointerenter", showAlternateImage);
  media.addEventListener("pointerleave", showPrimaryImage);
  media.addEventListener("focusin", showAlternateImage);
  media.addEventListener("focusout", showPrimaryImage);

  const details = document.createElement("button");
  details.className = "product-card__details";
  details.type = "button";
  details.textContent = `${product.name} — VER DETALHES ↗`;
  details.addEventListener("click", () => {
    openProductDetails(
      product,
      Number(card.dataset.activeVariant ?? 0),
      card.dataset.variantSelected === "true",
    );
  });

  media.addEventListener("click", () => {
    openProductDetails(
      product,
      Number(card.dataset.activeVariant ?? 0),
      card.dataset.variantSelected === "true",
    );
  });

  const purchaseRow = createElement("div", "product-card__purchase-row");
  const price = createPriceDisplay(product, "product-card__price");
  const addButton = createElement("button", "product-card__add", "＋ Sacola");
  addButton.type = "button";
  addButton.addEventListener("click", () => {
    const variantIndex = Number(card.dataset.activeVariant ?? 0);
    if (
      product.sizeChart ||
      (hasMultipleVariants && card.dataset.variantSelected !== "true")
    ) {
      openProductDetails(
        product,
        variantIndex,
        card.dataset.variantSelected === "true",
      );
      return;
    }
    addToCart(product, variantIndex);
  });
  const actions = createElement("div", "product-card__actions");
  const purchaseButton = createElement("button", "product-card__buy");
  purchaseButton.type = "button";
  purchaseButton.addEventListener("click", () => {
    const variantIndex = Number(card.dataset.activeVariant ?? 0);
    if (
      product.sizeChart ||
      (hasMultipleVariants && card.dataset.variantSelected !== "true")
    ) {
      openProductDetails(
        product,
        variantIndex,
        card.dataset.variantSelected === "true",
      );
      return;
    }
    try {
      window.location.assign(
        getYampiCheckoutUrl(product, product.variants[variantIndex].id, null, 1),
      );
    } catch (error) {
      console.error("Não foi possível iniciar o checkout do produto:", error);
      purchaseButton.title = error.message;
      purchaseButton.textContent = "ERRO NO CHECKOUT";
    }
  });
  const updateCardActions = () => {
    const variantIndex = Number(card.dataset.activeVariant ?? 0);
    const variant = product.variants[variantIndex];
    const variantSelected =
      !hasMultipleVariants || card.dataset.variantSelected === "true";
    const checkoutLink = findCheckoutLink(product, variant.id, null);
    if (product.sizeChart) {
      purchaseButton.textContent = variantSelected
        ? "ESCOLHER TAMANHO"
        : "ESCOLHER COR";
      addButton.hidden = true;
      actions.classList.add("product-card__actions--single");
    } else {
      purchaseButton.textContent = variantSelected
        ? checkoutLink
          ? "COMPRAR AGORA"
          : "INDISPONÍVEL"
        : "ESCOLHER COR";
      purchaseButton.disabled = variantSelected && !checkoutLink;
      purchaseButton.classList.toggle(
        "is-unavailable",
        variantSelected && !checkoutLink,
      );
      purchaseButton.setAttribute(
        "aria-label",
        variantSelected && checkoutLink
          ? `Comprar ${product.name}, opção ${variant.label}`
          : variantSelected
            ? `Checkout indisponível para ${product.name}, opção ${variant.label}`
            : `Escolher cor de ${product.name} antes de comprar`,
      );
      addButton.disabled = variantSelected && !checkoutLink;
      addButton.setAttribute(
        "aria-label",
        variantSelected
          ? `Adicionar ${product.name}, opção ${variant.label}, à sacola`
          : `Escolher cor de ${product.name} antes de adicionar à sacola`,
      );
      actions.classList.remove("product-card__actions--single");
    }
  };
  const originalSelectVariant = (variantIndex) => {
    card.dataset.activeVariant = String(variantIndex);
    updateCardActions();
  };
  swatches.addEventListener("click", (event) => {
    const swatchIndex = [...swatches.children].indexOf(event.target.closest("button"));
    if (swatchIndex >= 0) originalSelectVariant(swatchIndex);
  });
  actions.append(purchaseButton, addButton);
  updateCardActions();
  purchaseRow.append(price, actions);

  const description = createElement(
    "p",
    "product-card__description",
    getDescriptionSummary(product.description),
  );
  card.append(media, details, description, purchaseRow, swatches);
  return card;
}

function renderCategoryFilters() {
  const filters = document.querySelector("#collection-filters");
  if (!filters) return;
  const choices = [
    { id: "all", name: "Todos" },
    ...categories.filter((category) => category.kind === "filter"),
  ];
  filters.replaceChildren(
    ...choices.map((category) => {
      const button = createElement("button", "collection-filter", category.name);
      button.type = "button";
      button.setAttribute(
        "aria-pressed",
        String(activeCategoryId === category.id),
      );
      button.addEventListener("click", () => {
        activeCategoryId = category.id;
        filters.querySelectorAll("button").forEach((filter) => {
          filter.setAttribute("aria-pressed", String(filter === button));
        });
        renderProductGrid();
      });
      return button;
    }),
  );
}

function getCategoryImage(category, type) {
  return category[type] || category.desktopImage || category.mobileImage || "";
}

function renderCategoryBanners() {
  const container = document.querySelector("#category-banners");
  if (!container) return;
  const bannerCategories = categories.filter(
    (category) => category.kind === "banner",
  );
  window.clearInterval(categoryCarouselTimer);
  if (!bannerCategories.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }

  container.hidden = false;
  const track = createElement("div", "category-carousel__track");
  bannerCategories.forEach((category) => {
      const link = createElement("a", "category-banner");
      link.href = `#categoria/${category.id}`;
      link.setAttribute("aria-label", `Abrir categoria ${category.name}`);
      const picture = document.createElement("picture");
      const mobileSource = document.createElement("source");
      mobileSource.media = "(max-width: 760px)";
      mobileSource.srcset = getCategoryImage(category, "mobileImage");
      const image = document.createElement("img");
      image.src = getCategoryImage(category, "desktopImage");
      image.alt = category.title || category.name;
      picture.append(mobileSource, image);
      link.append(picture);
      track.append(link);
  });
  let currentIndex = 0;
  const moveTo = (index) => {
    currentIndex = (index + bannerCategories.length) % bannerCategories.length;
    track.scrollTo({ left: currentIndex * track.clientWidth, behavior: "smooth" });
  };
  const previous = createElement("button", "category-carousel__arrow category-carousel__arrow--previous", "‹");
  previous.type = "button";
  previous.setAttribute("aria-label", "Banner anterior");
  previous.addEventListener("click", () => moveTo(currentIndex - 1));
  const next = createElement("button", "category-carousel__arrow category-carousel__arrow--next", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Próximo banner");
  next.addEventListener("click", () => moveTo(currentIndex + 1));
  container.replaceChildren(track, previous, next);
  if (bannerCategories.length > 1) {
    categoryCarouselTimer = window.setInterval(() => moveTo(currentIndex + 1), 5000);
  }
}

function renderComboShowcase() {
  const container = document.querySelector("#combo-showcase");
  if (!container) return;
  const comboCategory = categories.find((category) => category.kind === "combo");
  window.clearInterval(comboCarouselTimer);
  if (!comboCategory) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  const comboProducts = products.filter(
    (product) => product.comboCategoryId === comboCategory.id,
  );
  if (!comboProducts.length) {
    container.hidden = true;
    container.replaceChildren();
    return;
  }
  container.hidden = false;
  const picture = document.createElement("picture");
  picture.className = "combo-showcase__background";
  const mobileSource = document.createElement("source");
  mobileSource.media = "(max-width: 760px)";
  mobileSource.srcset = getCategoryImage(comboCategory, "mobileImage");
  const background = document.createElement("img");
  background.src = getCategoryImage(comboCategory, "desktopImage");
  background.alt = "";
  background.setAttribute("aria-hidden", "true");
  picture.append(mobileSource, background);

  const track = createElement("div", "combo-showcase__track");
  track.setAttribute("role", "list");
  const cards = comboProducts.map((product, index) => {
    const card = createProductCard(product, index);
    card.classList.add("combo-showcase__card");
    track.append(card);
    return card;
  });
  let currentIndex = 0;
  const moveTo = (index) => {
    currentIndex = (index + cards.length) % cards.length;
    track.scrollTo({
      left: cards[currentIndex].offsetLeft - track.offsetLeft,
      behavior: "smooth",
    });
  };
  const previous = createElement(
    "button",
    "combo-showcase__arrow combo-showcase__arrow--previous",
    "‹",
  );
  previous.type = "button";
  previous.setAttribute("aria-label", "Kit anterior");
  previous.addEventListener("click", () => moveTo(currentIndex - 1));
  const next = createElement(
    "button",
    "combo-showcase__arrow combo-showcase__arrow--next",
    "›",
  );
  next.type = "button";
  next.setAttribute("aria-label", "Próximo kit");
  next.addEventListener("click", () => moveTo(currentIndex + 1));
  container.replaceChildren(picture, track, previous, next);
  if (cards.length > 1) {
    comboCarouselTimer = window.setInterval(() => moveTo(currentIndex + 1), 5000);
  }
}

function renderProductGrid() {
  const container = document.querySelector("#product-grid");
  if (!container) return;
  const visibleProducts =
    activeCategoryId === "all"
      ? products.filter((product) => !product.catalogOnly)
      : products.filter(
          (product) =>
            product.categoryId === activeCategoryId && !product.catalogOnly,
        );
  if (visibleProducts.length === 0) {
    container.replaceChildren(
      createElement(
        "p",
        "product-grid__empty",
        "Ainda não há produtos nesta categoria.",
      ),
    );
    return;
  }
  container.replaceChildren(
    ...visibleProducts.map((product, index) => createProductCard(product, index)),
  );
}

function renderCategoryPage(categoryId) {
  const root = document.querySelector("#category-page");
  const category = categories.find((entry) => entry.id === categoryId);
  if (!root || !category) return false;
  const categoryProducts = products.filter(
    (product) =>
      category.kind === "combo"
        ? product.comboCategoryId === category.id
        : product.categoryId === category.id,
  );
  const picture = document.createElement("picture");
  const mobileSource = document.createElement("source");
  mobileSource.media = "(max-width: 760px)";
  mobileSource.srcset = getCategoryImage(category, "mobileImage");
  const image = document.createElement("img");
  image.src = getCategoryImage(category, "desktopImage");
  image.alt = category.title || category.name;
  picture.append(mobileSource, image);
  const back = createElement("a", "category-page__back", "← VOLTAR À LOJA");
  back.href = "#inicio";
  const intro = createElement("div", "category-page__intro");
  intro.append(back);
  const grid = createElement("div", "product-grid", "");
  grid.setAttribute("role", "list");
  grid.replaceChildren(
    ...categoryProducts.map((product, index) =>
      createProductCard(product, index),
    ),
  );
  root.replaceChildren(
    picture,
    intro,
    grid,
  );
  root.hidden = false;
  return true;
}

function getKitBuilderConfig(settings) {
  const defaults = {
    enabled: true,
    title: "Monte seu kit",
    subtitle:
      "Escolha suas peças, combine suas cores e monte uma seleção com a sua personalidade.",
    desktopBanner: "",
    mobileBanner: "",
    tiers: [
      { minItems: 2, discountPercent: 10 },
      { minItems: 3, discountPercent: 15 },
      { minItems: 4, discountPercent: 20 },
    ],
  };
  const saved = settings.kitBuilder ?? {};
  const isLegacyTierConfig =
    Array.isArray(saved.tiers) &&
    saved.tiers.some((tier) => tier.minItems === 5);
  const savedTierByMinItems = (minItems) =>
    Array.isArray(saved.tiers)
      ? saved.tiers.find((savedTier) => savedTier.minItems === minItems)
      : undefined;
  return {
    ...defaults,
    ...saved,
    tiers: defaults.tiers.map((tier) => ({
      ...tier,
      ...(!isLegacyTierConfig
        ? savedTierByMinItems(tier.minItems)
        : null),
    })),
  };
}

function getKitEntries() {
  return [...kitItems.values()];
}

function getKitQuantity() {
  return getKitEntries().reduce((total, item) => total + item.quantity, 0);
}

function getKitSubtotalCents() {
  return getKitEntries().reduce((total, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return total + (product ? getCurrentPriceCents(product) * item.quantity : 0);
  }, 0);
}

function getKitUnitPriceCents(product, tier = getKitTier()) {
  return Math.round(
    (getCurrentPriceCents(product) * (100 - tier.discountPercent)) / 100,
  );
}

function getKitDiscountedSubtotalCents(entries, tier = getKitTier()) {
  return entries.reduce((total, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return total + (product ? getKitUnitPriceCents(product, tier) * item.quantity : 0);
  }, 0);
}

function getKitTier(minItems = selectedKitTierMinItems) {
  return (
    kitBuilderSettings.tiers.find((tier) => tier.minItems === minItems) ??
    kitBuilderSettings.tiers[0]
  );
}

function getKitTierForQuantity(quantity) {
  if (quantity >= 4) return getKitTier(4);
  if (quantity >= 3) return getKitTier(3);
  return getKitTier(2);
}

function getKitTierMaxItems(tier) {
  return tier.minItems === 4 ? Number.POSITIVE_INFINITY : tier.minItems;
}

function canSelectKitTier(tier) {
  return getKitQuantity() <= getKitTierMaxItems(tier);
}

function persistKitTierSelection() {
  try {
    sessionStorage.setItem(KIT_TIER_STORAGE_KEY, String(selectedKitTierMinItems));
  } catch (error) {
    console.error("Não foi possível manter a opção do kit nesta sessão:", error);
  }
}

function persistKitItems() {
  try {
    sessionStorage.setItem(KIT_STORAGE_KEY, JSON.stringify(getKitEntries()));
  } catch (error) {
    console.error("Não foi possível manter o kit nesta sessão:", error);
  }
}

function restoreKitItems() {
  if (kitItemsRestored) return;
  kitItemsRestored = true;
  try {
    const savedTier = Number(sessionStorage.getItem(KIT_TIER_STORAGE_KEY));
    if (kitBuilderSettings.tiers.some((tier) => tier.minItems === savedTier)) {
      selectedKitTierMinItems = savedTier;
    }
    const savedItems = JSON.parse(sessionStorage.getItem(KIT_STORAGE_KEY) || "[]");
    if (!Array.isArray(savedItems)) {
      throw new Error("Os itens salvos para o kit não têm um formato válido.");
    }
    savedItems.forEach((item) => {
      const product = products.find((entry) => entry.id === item?.productId);
      const variant = product?.variants.find(
        (entry) => entry.id === item?.variantId,
      );
      if (
        !product ||
        !variant ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1
      ) {
        return;
      }
      if (!findCheckoutLink(product, variant.id, item.size ?? null)) {
        return;
      }
      const key = `${product.id}:${variant.id}:${item.size ?? ""}`;
      kitItems.set(key, {
        productId: product.id,
        variantId: variant.id,
        variantIndex: product.variants.indexOf(variant),
        size: item.size ?? null,
        quantity: item.quantity,
      });
    });
    if (!canSelectKitTier(getKitTier())) {
      selectedKitTierMinItems = getKitTierForQuantity(getKitQuantity()).minItems;
      persistKitTierSelection();
    }
  } catch (error) {
    console.error("Não foi possível restaurar o kit desta sessão:", error);
  }
}

function renderKitBuilderPage() {
  const root = document.querySelector("#kit-builder");
  if (!root || !kitBuilderSettings?.enabled) return false;

  const topbar = createElement("div", "kit-builder__topbar");
  const brand = document.createElement("a");
  brand.className = "kit-builder__brand";
  brand.href = "#inicio";
  brand.setAttribute("aria-label", "REHVA — início");
  const brandLogo = document.createElement("img");
  brandLogo.src = "/assets/brand/logo.png";
  brandLogo.alt = "REHVA";
  brand.append(brandLogo);
  const cartTrigger = document.querySelector("#cart-trigger");
  topbar.append(brand);
  if (cartTrigger) topbar.append(cartTrigger);

  const intro = createElement("header", "kit-builder__intro");
  if (kitBuilderSettings.desktopBanner || kitBuilderSettings.mobileBanner) {
    const accessibleTitle = createElement(
      "h1",
      "visually-hidden",
      kitBuilderSettings.title,
    );
    accessibleTitle.id = "kit-builder-title";
    const back = createElement(
      "a",
      "kit-builder__back kit-builder__back--banner",
      "VOLTAR À LOJA",
    );
    back.href = "#inicio";
    const picture = document.createElement("picture");
    const mobileSource = document.createElement("source");
    mobileSource.media = "(max-width: 760px)";
    mobileSource.srcset =
      kitBuilderSettings.mobileBanner || kitBuilderSettings.desktopBanner;
    const banner = document.createElement("img");
    banner.src =
      kitBuilderSettings.desktopBanner || kitBuilderSettings.mobileBanner;
    banner.alt = kitBuilderSettings.title;
    banner.fetchPriority = "high";
    picture.append(mobileSource, banner);
    intro.classList.add("kit-builder__intro--banner");
    intro.append(accessibleTitle, back, picture);
  } else {
    const back = createElement("a", "kit-builder__back", "VOLTAR À LOJA");
    back.href = "#inicio";
    const eyebrow = createElement(
      "p",
      "kit-builder__eyebrow",
      "SUA SELEÇÃO, DO SEU JEITO",
    );
    const title = createElement(
      "h1",
      "kit-builder__title",
      kitBuilderSettings.title,
    );
    title.id = "kit-builder-title";
    const subtitle = createElement(
      "p",
      "kit-builder__subtitle",
      kitBuilderSettings.subtitle,
    );
    intro.append(back, eyebrow, title, subtitle);
  }

  const content = createElement("div", "kit-builder__content");
  const catalogSection = createElement("section", "kit-builder__catalog");
  catalogSection.id = "kit-catalog";
  const catalogHeading = createElement("div", "kit-builder__section-heading");
  catalogHeading.append(
    createElement("p", "kit-builder__eyebrow", "ESCOLHA SUAS PEÇAS"),
    createElement("h2", "", "Monte uma combinação só sua"),
  );
  const tierSelector = createElement("div", "kit-builder__tiers");
  tierSelector.append(
    createElement("p", "kit-builder__tiers-label", "ESCOLHA O TAMANHO DO SEU KIT"),
  );
  const tierOptions = createElement("div", "kit-builder__tier-options");
  kitBuilderSettings.tiers.forEach((tier) => {
    const option = createElement("button", "kit-builder__tier-option");
    option.type = "button";
    option.classList.toggle(
      "is-selected",
      tier.minItems === selectedKitTierMinItems,
    );
    option.disabled = !canSelectKitTier(tier);
    option.setAttribute(
      "aria-pressed",
      String(tier.minItems === selectedKitTierMinItems),
    );
    option.append(
      createElement(
        "strong",
        "",
        tier.minItems === 4 ? "4+ peças" : `${tier.minItems} peças`,
      ),
      createElement("span", "", `${tier.discountPercent}% OFF`),
    );
    option.addEventListener("click", () => {
      if (!canSelectKitTier(tier)) return;
      selectedKitTierMinItems = tier.minItems;
      persistKitTierSelection();
      renderKitBuilderPage();
    });
    tierOptions.append(option);
  });
  tierSelector.append(tierOptions);
  const grid = createElement("div", "kit-builder__grid");
  products.forEach((product) => {
    grid.append(createKitProductCard(product));
  });
  catalogSection.append(catalogHeading, tierSelector, grid);

  const summary = createElement("aside", "kit-builder__summary");
  summary.setAttribute("aria-label", "Resumo do seu kit");
  content.append(catalogSection, summary);

  root.replaceChildren(topbar, intro, content);
  root.hidden = false;
  renderKitSummary(summary);
  return true;
}

function createKitProductCard(product) {
  const card = createElement("article", "kit-product");
  const image = document.createElement("img");
  image.className = "kit-product__image";
  image.src = product.variants[0]?.first ?? "";
  image.alt = product.name;
  image.loading = "lazy";
  image.decoding = "async";
  const info = createElement("div", "kit-product__info");
  const name = createElement("h3", "kit-product__name", product.name);
  const currentPriceCents = getCurrentPriceCents(product);
  const selectedTier = getKitTier();
  const price = createElement("div", "kit-product__price-block");
  const estimatedPriceCents = getKitUnitPriceCents(product, selectedTier);
  const prices = createElement("div", "kit-product__prices");
  prices.append(
    createElement(
      "del",
      "kit-product__price-original",
      formatPrice(currentPriceCents),
    ),
    createElement(
      "strong",
      "kit-product__price kit-product__price--discount",
      formatPrice(estimatedPriceCents),
    ),
  );
  price.append(
    prices,
    createElement(
      "small",
      "kit-product__discount-condition",
      `${selectedTier.discountPercent}% OFF automático no checkout`,
    ),
  );
  const variantLabel = createElement("label", "kit-product__choice");
  variantLabel.append(createElement("span", "", "Cor ou opção"));
  const variantSelect = document.createElement("select");
  variantSelect.setAttribute("aria-label", `Cor ou opção de ${product.name}`);
  const availableVariants = product.variants.filter((variant) =>
    product.sizeChart?.length
      ? product.sizeChart.some((size) =>
        findCheckoutLink(product, variant.id, size.size),
      )
      : Boolean(findCheckoutLink(product, variant.id, null)),
  );
  product.variants.forEach((variant) => {
    const option = document.createElement("option");
    option.value = variant.id;
    option.textContent = variant.label;
    option.disabled = !availableVariants.includes(variant);
    variantSelect.append(option);
  });
  if (availableVariants.length) {
    variantSelect.value = availableVariants[0].id;
    image.src = availableVariants[0].first;
  } else {
    variantSelect.disabled = true;
  }
  variantLabel.append(variantSelect);

  let sizeSelect = null;
  if (product.sizeChart?.length) {
    const sizeLabel = createElement("label", "kit-product__choice");
    sizeLabel.append(createElement("span", "", "Tamanho"));
    sizeSelect = document.createElement("select");
    sizeSelect.setAttribute("aria-label", `Tamanho de ${product.name}`);
    sizeLabel.append(sizeSelect);
    info.append(name, price, variantLabel, sizeLabel);
  } else {
    info.append(name, price, variantLabel);
  }

  const status = createElement("p", "kit-product__status");
  status.setAttribute("role", "status");
  const addButton = createElement(
    "button",
    "kit-product__add",
    "ADICIONAR AO KIT",
  );
  addButton.type = "button";
  const updateAvailability = () => {
    const variant = product.variants.find(
      (entry) => entry.id === variantSelect.value,
    );
    if (sizeSelect) {
      const availableSizes = product.sizeChart.filter((size) =>
        findCheckoutLink(product, variant?.id, size.size),
      );
      const previousSize = sizeSelect.value;
      sizeSelect.replaceChildren(
        ...product.sizeChart.map((size) => {
          const option = document.createElement("option");
          option.value = size.size;
          option.textContent = size.size;
          option.disabled = !availableSizes.includes(size);
          return option;
        }),
      );
      sizeSelect.value = availableSizes.some(
        (size) => size.size === previousSize,
      )
        ? previousSize
        : (availableSizes[0]?.size ?? "");
      sizeSelect.disabled = !availableSizes.length;
    }
    if (variant) image.src = variant.first;
    const size = sizeSelect?.value ?? null;
    const selectedTier = getKitTier();
    const kitQuantity = getKitQuantity();
    const canAddWithinTier =
      selectedTier.minItems === 4 || kitQuantity < selectedTier.minItems;
    const available =
      variant &&
      (product.sizeChart
        ? Boolean(
            size &&
              findCheckoutLink(product, variant.id, size),
          )
        : Boolean(findCheckoutLink(product, variant.id, null)));
    addButton.disabled = !available || !canAddWithinTier;
    status.textContent = available
      ? canAddWithinTier
        ? ""
        : `Kit de ${selectedTier.minItems} peças completo. Escolha um kit maior para adicionar mais.`
      : "Cadastre o link de compra Yampi desta cor e tamanho no produto.";
  };
  variantSelect.addEventListener("change", updateAvailability);
  sizeSelect?.addEventListener("change", updateAvailability);
  addButton.addEventListener("click", () => {
    const variant = product.variants.find(
      (entry) => entry.id === variantSelect.value,
    );
    const size = sizeSelect?.value ?? null;
    if (
      !variant ||
      addButton.disabled ||
      !findCheckoutLink(product, variant.id, size)
    ) {
      return;
    }
    const key = `${product.id}:${variant.id}:${size ?? ""}`;
    const existing = kitItems.get(key);
    if (existing) {
      existing.quantity += 1;
    } else {
      kitItems.set(key, {
        productId: product.id,
        variantId: variant.id,
        variantIndex: product.variants.indexOf(variant),
        size,
        quantity: 1,
      });
    }
    persistKitItems();
    renderKitBuilderPage();
  });
  info.append(status, addButton);
  card.append(image);
  card.append(info);
  updateAvailability();
  return card;
}

function renderKitSummary(summary) {
  const entries = getKitEntries();
  const quantity = getKitQuantity();
  const tier = getKitTier();
  const maxItems = getKitTierMaxItems(tier);
  const subtotalCents = getKitSubtotalCents();
  const estimatedTotalCents = getKitDiscountedSubtotalCents(entries, tier);
  const discountCents = Math.max(0, subtotalCents - estimatedTotalCents);
  const quantityIsValid = quantity >= tier.minItems && quantity <= maxItems;
  const hasCheckoutLinks = entries.every((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return Boolean(
      product &&
        findCheckoutLink(product, item.variantId, item.size),
    );
  });
  const heading = createElement("p", "kit-builder__eyebrow", "SUA SELEÇÃO");
  const title = createElement(
    "h2",
    "",
    `Kit com ${tier.discountPercent}% de desconto`,
  );
  const count = createElement(
    "p",
    "kit-builder__count",
    `${quantity} ${quantity === 1 ? "peça selecionada" : "peças selecionadas"} · ${tier.minItems === 4 ? "kit a partir de 4 peças" : `kit de ${tier.minItems} peças`}`,
  );
  const offer = createElement("div", "kit-builder__offer");
  if (quantity < tier.minItems) {
    const remaining = tier.minItems - quantity;
    offer.append(
      createElement(
        "span",
        "",
        `Adicione ${remaining} ${remaining === 1 ? "peça" : "peças"} para completar seu kit e liberar ${tier.discountPercent}% OFF.`,
      ),
    );
  } else if (quantity > maxItems) {
    offer.append(
      createElement(
        "span",
        "",
        `Este kit aceita até ${tier.minItems} peças. Escolha uma faixa maior para continuar.`,
      ),
    );
  } else if (hasCheckoutLinks) {
    offer.append(
      createElement(
        "strong",
        "",
        `${tier.discountPercent}% OFF automático aplicado no checkout Yampi.`,
      ),
      createElement(
        "span",
        "",
        "A oferta é ativada pela quantidade de peças no pedido.",
      ),
    );
  } else {
    offer.append(
      createElement(
        "strong",
        "",
        `${tier.discountPercent}% OFF estimado para cada peça do kit.`,
      ),
      createElement(
        "span",
        "",
        "Cadastre o link de compra normal do produto para liberar a compra.",
      ),
    );
  }

  const itemList = createElement("div", "kit-builder__items");
  entries.forEach((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const variant = product?.variants.find(
      (entry) => entry.id === item.variantId,
    );
    if (!product || !variant) return;
    const row = createElement("article", "kit-builder__item");
    const image = document.createElement("img");
    image.src = variant.first;
    image.alt = "";
    image.loading = "lazy";
    const details = createElement("div", "kit-builder__item-details");
    details.append(
      createElement("strong", "", product.name),
      createElement(
        "span",
        "",
        `${variant.label}${item.size ? ` · ${item.size}` : ""}`,
      ),
      createElement(
        "span",
        "",
        `${formatPrice(getCurrentPriceCents(product))} por peça`,
      ),
      createElement(
        "strong",
        "",
        `${formatPrice(getKitUnitPriceCents(product, tier))} no kit · ${formatPrice(getKitUnitPriceCents(product, tier) * item.quantity)} total`,
      ),
    );
    const controls = createElement("div", "kit-builder__quantity");
    const decrease = createElement("button", "", "−");
    decrease.type = "button";
    decrease.setAttribute("aria-label", `Diminuir ${product.name}`);
    decrease.addEventListener("click", () => {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        kitItems.delete(`${item.productId}:${item.variantId}:${item.size ?? ""}`);
      }
      persistKitItems();
      renderKitBuilderPage();
    });
    const quantityLabel = createElement("span", "", String(item.quantity));
    const increase = createElement("button", "", "+");
    increase.type = "button";
    increase.setAttribute("aria-label", `Aumentar ${product.name}`);
    increase.disabled = quantity >= maxItems;
    increase.addEventListener("click", () => {
      if (item.quantity >= Number.MAX_SAFE_INTEGER) return;
      item.quantity += 1;
      persistKitItems();
      renderKitBuilderPage();
    });
    controls.append(decrease, quantityLabel, increase);
    row.append(image, details, controls);
    itemList.append(row);
  });

  const totals = createElement("div", "kit-builder__totals");
  const subtotal = createElement("div", "kit-builder__total-row");
  const subtotalLabel = createElement("span", "", "Subtotal");
  const subtotalValue = createElement(
    "strong",
    quantity ? "kit-builder__price-original" : "",
    formatPrice(subtotalCents),
  );
  subtotal.append(
    subtotalLabel,
    subtotalValue,
  );
  totals.append(subtotal);
  const discount = createElement(
    "div",
    "kit-builder__total-row kit-builder__total-row--discount",
  );
  discount.append(
    createElement(
      "span",
      "",
      `Economia estimada (${tier.discountPercent}%)`,
    ),
    createElement("strong", "", `− ${formatPrice(discountCents)}`),
  );
  const estimatedTotal = createElement(
    "div",
    "kit-builder__total-row kit-builder__total-row--final",
  );
  estimatedTotal.append(
    createElement(
      "span",
      "",
      "Total estimado",
    ),
    createElement("strong", "", formatPrice(estimatedTotalCents)),
  );
  totals.append(discount, estimatedTotal);
  const notice = createElement(
    "p",
    "kit-builder__notice",
    "O kit usa somente o desconto automático da quantidade. O cupom de primeira compra não é aplicado nem acumulado;",
  );
  if (entries.length && !hasCheckoutLinks) {
    notice.textContent =
      "Cadastre no produto o link de compra Yampi para cada cor e tamanho selecionados.";
  }
  const remaining = Math.max(0, tier.minItems - quantity);
  const checkoutLabel =
    remaining > 0
      ? `ADICIONE ${remaining} ${remaining === 1 ? "PEÇA" : "PEÇAS"} PARA LIBERAR`
      : `FINALIZAR KIT COM ${tier.discountPercent}% OFF`;
  const checkout = createElement("button", "kit-builder__checkout", checkoutLabel);
  checkout.type = "button";
  checkout.disabled =
    !entries.length || !quantityIsValid || !hasCheckoutLinks;
  checkout.addEventListener("click", () => {
    if (!entries.length) {
      document.querySelector("#kit-catalog")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    if (!quantityIsValid || !hasCheckoutLinks) return;
    try {
      window.location.assign(
        createYampiCartCheckoutUrl(entries),
      );
    } catch (error) {
      console.error("Não foi possível abrir o checkout do kit:", error);
      notice.textContent = error.message;
    }
  });
  const clear = createElement("button", "kit-builder__clear", "LIMPAR SELEÇÃO");
  clear.type = "button";
  clear.disabled = !entries.length;
  clear.addEventListener("click", () => {
    kitItems.clear();
    persistKitItems();
    renderKitBuilderPage();
  });
  summary.replaceChildren(
    heading,
    title,
    count,
    offer,
    itemList,
    totals,
    notice,
    checkout,
    clear,
  );
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createProductCouponCarousel() {
  const section = createElement("section", "product-detail__coupons");
  section.setAttribute("aria-label", "Cupons da loja");
  section.append(
    createElement(
      "h2",
      "product-detail__coupons-heading",
      "CUPOM DISPONÍVEL PARA VOCÊ",
    ),
  );

  const track = createElement("div", "product-detail__coupons-track");
  track.setAttribute("role", "region");
  track.setAttribute("aria-roledescription", "carrossel");
  track.setAttribute("aria-label", "Ofertas de cupons");

  const firstSlide = createElement(
    "article",
    "product-coupon product-coupon--available",
  );
  firstSlide.setAttribute("role", "group");
  firstSlide.setAttribute("aria-roledescription", "slide");
  firstSlide.setAttribute("aria-label", "Cupom para primeira compra");
  const firstCopy = createElement("div", "product-coupon__copy");
  firstCopy.append(
    createElement("span", "product-coupon__eyebrow", "PRIMEIRA COMPRA"),
    createElement(
      "strong",
      "product-coupon__offer",
      `${storeCouponSettings.firstPurchasePercent}% OFF`,
    ),
    createElement("span", "product-coupon__description", "Use seu cupom na loja"),
  );
  const copyButton = createElement(
    "button",
    "product-coupon__code",
    storeCouponSettings.firstPurchaseCode,
  );
  copyButton.type = "button";
  copyButton.setAttribute(
    "aria-label",
    `Copiar cupom ${storeCouponSettings.firstPurchaseCode} de ${storeCouponSettings.firstPurchasePercent}% para primeira compra`,
  );
  const feedback = createElement("span", "visually-hidden");
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");
  copyButton.addEventListener("click", async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(storeCouponSettings.firstPurchaseCode);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = storeCouponSettings.firstPurchaseCode;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) throw new Error("A cópia não foi autorizada pelo navegador.");
      }
      feedback.textContent = `Cupom ${storeCouponSettings.firstPurchaseCode} copiado.`;
      copyButton.textContent = "COPIADO!";
    } catch (error) {
      console.error("Não foi possível copiar o cupom de primeira compra:", error);
      feedback.textContent = `Não foi possível copiar. Seu cupom é ${storeCouponSettings.firstPurchaseCode}.`;
    }
  });
  firstSlide.append(firstCopy, copyButton);

  const lockedSlide = createElement(
    "article",
    "product-coupon product-coupon--locked",
  );
  lockedSlide.setAttribute("role", "group");
  lockedSlide.setAttribute("aria-roledescription", "slide");
  lockedSlide.setAttribute("aria-label", "Cupom bloqueado para próxima compra");
  const lockedCopy = createElement("div", "product-coupon__copy");
  lockedCopy.append(
    createElement("span", "product-coupon__eyebrow", "PRÓXIMA COMPRA"),
    createElement(
      "strong",
      "product-coupon__offer",
      `${storeCouponSettings.repeatPurchasePercent}% OFF`,
    ),
    createElement(
      "span",
      "product-coupon__description",
      "Desbloqueie após concluir sua primeira compra",
    ),
  );
  const lockedState = createElement(
    "span",
    "product-coupon__locked-label",
    "🔒 BLOQUEADO",
  );
  lockedState.setAttribute("aria-label", "Cupom bloqueado");
  lockedSlide.append(lockedCopy, lockedState);
  track.append(firstSlide, lockedSlide);

  const navigation = createElement("div", "product-detail__coupons-navigation");
  navigation.setAttribute("aria-label", "Navegação dos cupons");
  const previous = createElement("button", "", "‹");
  previous.type = "button";
  previous.setAttribute("aria-label", "Cupom anterior");
  const next = createElement("button", "", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Próximo cupom");
  const indicators = createElement("div", "product-detail__coupons-indicators");
  const dots = [0, 1].map((index) => {
    const dot = createElement("button", "product-detail__coupons-dot");
    dot.type = "button";
    dot.setAttribute("aria-label", `Ver cupom ${index + 1}`);
    dot.setAttribute("aria-current", String(index === 0));
    dot.addEventListener("click", () => {
      track.scrollTo({ left: track.clientWidth * index, behavior: "smooth" });
    });
    indicators.append(dot);
    return dot;
  });
  let currentSlide = 0;
  const updateCarousel = (index) => {
    currentSlide = Math.max(0, Math.min(1, index));
    dots.forEach((dot, dotIndex) => {
      dot.setAttribute("aria-current", String(dotIndex === currentSlide));
    });
    previous.disabled = currentSlide === 0;
    next.disabled = currentSlide === 1;
  };
  previous.addEventListener("click", () => {
    track.scrollTo({ left: 0, behavior: "smooth" });
  });
  next.addEventListener("click", () => {
    track.scrollTo({ left: track.clientWidth, behavior: "smooth" });
  });
  track.addEventListener("scroll", () => {
    if (track.clientWidth) {
      updateCarousel(Math.round(track.scrollLeft / track.clientWidth));
    }
  });
  navigation.append(previous, indicators, next);
  section.append(track, navigation, feedback);
  updateCarousel(0);
  return section;
}

function getProductIdFromLocation() {
  const match = window.location.hash.match(/^#produto\/([a-z0-9-]+)$/);
  return match?.[1] ?? null;
}

function renderProductDetails(
  productId,
  preferredVariant = 0,
  preferredVariantSelected = false,
) {
  const root = document.querySelector("#product-detail");
  const store = document.querySelector("#store");
  const product = products.find((item) => item.id === productId);

  if (!root || !store) return;

  if (!product) {
    root.hidden = true;
    store.classList.remove("is-product-detail");
    return;
  }

  if (!productDetailsVisible && productDetailsReturnScrollY === null) {
    const collection = document.querySelector("#colecao");
    productDetailsReturnScrollY =
      collection.getBoundingClientRect().top + window.scrollY;
  }

  let currentVariantIndex = Math.min(
    Math.max(preferredVariant, 0),
    product.variants.length - 1,
  );
  let variantSelected =
    product.variants.length === 1 || preferredVariantSelected;
  let currentImageIndex = 0;
  const currentVariant = () => product.variants[currentVariantIndex];

  const content = createElement("div", "product-detail__inner");
  const topbar = createElement("div", "product-detail__topbar");
  const brand = document.createElement("a");
  brand.className = "product-detail__brand";
  brand.href = "#inicio";
  brand.setAttribute("aria-label", "REHVA — início");
  const brandLogo = document.createElement("img");
  brandLogo.src = "/assets/brand/logo.png";
  brandLogo.alt = "REHVA";
  brand.append(brandLogo);
  const cartTrigger = document.querySelector("#cart-trigger");
  topbar.append(brand);
  if (cartTrigger) topbar.append(cartTrigger);

  const breadcrumbs = createElement("nav", "product-detail__breadcrumbs");
  breadcrumbs.setAttribute("aria-label", "Você está em");
  const collectionLink = createElement("a", "", "A COLEÇÃO");
  collectionLink.href = "#colecao";
  const separator = createElement("span", "", "/");
  separator.setAttribute("aria-hidden", "true");
  const breadcrumbName = createElement("span", "", product.name);
  breadcrumbs.append(collectionLink, separator, breadcrumbName);

  const backButton = createElement(
    "button",
    "product-detail__back",
    "← VOLTAR À COLEÇÃO",
  );
  backButton.type = "button";
  backButton.addEventListener("click", () => {
    if (window.history.state?.rehvaProductId) {
      window.history.back();
      return;
    }
    window.history.replaceState({}, "", "#colecao");
    syncProductRoute();
  });

  const layout = createElement("div", "product-detail__layout");
  const productHeader = createElement("header", "product-detail__header");
  const gallery = createElement("div", "product-detail__gallery");
  const mainImageFrame = createElement("div", "product-detail__main-image");
  const imageTrack = createElement("div", "product-detail__image-track");
  imageTrack.setAttribute("aria-label", "Galeria de imagens do produto");
  const previousImage = createElement(
    "button",
    "product-detail__arrow product-detail__arrow--previous",
    "‹",
  );
  previousImage.type = "button";
  previousImage.setAttribute("aria-label", "Imagem anterior");
  const nextImage = createElement(
    "button",
    "product-detail__arrow product-detail__arrow--next",
    "›",
  );
  nextImage.type = "button";
  nextImage.setAttribute("aria-label", "Próxima imagem");
  mainImageFrame.append(imageTrack, previousImage, nextImage);

  const imageViewer = document.createElement("dialog");
  imageViewer.className = "product-image-viewer";
  imageViewer.setAttribute("aria-label", `Visualização ampliada de ${product.name}`);
  const viewerTrack = createElement("div", "product-image-viewer__track");
  viewerTrack.setAttribute("aria-label", "Imagens ampliadas do produto");
  const viewerClose = createElement(
    "button",
    "product-image-viewer__close",
    "×",
  );
  viewerClose.type = "button";
  viewerClose.setAttribute("aria-label", "Fechar visualização da imagem");
  const viewerPrevious = createElement(
    "button",
    "product-image-viewer__arrow product-image-viewer__arrow--previous",
    "‹",
  );
  viewerPrevious.type = "button";
  viewerPrevious.setAttribute("aria-label", "Imagem ampliada anterior");
  const viewerNext = createElement(
    "button",
    "product-image-viewer__arrow product-image-viewer__arrow--next",
    "›",
  );
  viewerNext.type = "button";
  viewerNext.setAttribute("aria-label", "Próxima imagem ampliada");
  const viewerFooter = createElement("div", "product-image-viewer__footer");
  const viewerCounter = createElement("span", "product-image-viewer__counter");
  const viewerHint = createElement(
    "span",
    "product-image-viewer__hint",
    "Arraste para ver mais fotos",
  );
  const reviewCountLabel = new Intl.NumberFormat("pt-BR").format(
    product.reviewCount ?? 0,
  );
  const viewerTrust = createElement(
    "p",
    "product-image-viewer__trust",
    product.reviewCount > 0
      ? `♡ ${reviewCountLabel} pessoas já avaliaram este produto — quem comprou, aprovou.`
      : "♡ Seja uma das primeiras pessoas a avaliar este produto.",
  );
  viewerFooter.append(viewerCounter, viewerHint);
  imageViewer.append(
    viewerClose,
    viewerTrack,
    viewerPrevious,
    viewerNext,
    viewerFooter,
    viewerTrust,
  );
  imageViewer.addEventListener("click", (event) => {
    if (event.target === imageViewer) imageViewer.close();
  });
  viewerClose.addEventListener("click", () => imageViewer.close());

  const info = createElement("div", "product-detail__info");
  const eyebrow = createElement(
    "p",
    "product-detail__eyebrow",
    "SELEÇÃO REHVA",
  );
  const title = createElement("h1", "product-detail__title", product.name);
  title.id = "product-detail-title";
  title.tabIndex = -1;
  const ratingValue = Math.min(4.5, Math.max(0.5, product.reviewRating ?? 4.5));
  const ratingCount = product.reviewCount ?? 0;
  const rating = createElement("div", "product-detail__rating");
  rating.setAttribute(
    "aria-label",
    `Avaliação média ${ratingValue.toFixed(1).replace(".", ",")} de 5, baseada em ${ratingCount} avaliações`,
  );
  const stars = createElement("span", "product-detail__rating-stars");
  stars.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 5; index += 1) {
    const star = createElement("span", "product-detail__rating-star", "★");
    const difference = ratingValue - index;
    star.classList.add(
      difference >= 1 ? "is-full" : difference > 0 ? "is-half" : "is-empty",
    );
    stars.append(star);
  }
  const ratingText = createElement(
    "span",
    "product-detail__rating-text",
    `${ratingValue.toFixed(1).replace(".", ",")} · ${ratingCount} avaliações`,
  );
  rating.append(stars, ratingText);
  const price = createPriceDisplay(product, "product-detail__price");
  const descriptionPanel = createElement("section", "product-detail__description-panel");
  const descriptionHeading = createElement(
    "button",
    "product-detail__description-heading",
    "DESCRIÇÃO",
  );
  descriptionHeading.type = "button";
  descriptionHeading.setAttribute("aria-expanded", "true");
  descriptionHeading.setAttribute("aria-controls", "product-description-content");
  const descriptionIcon = createElement(
    "span",
    "product-detail__description-icon",
    "−",
  );
  descriptionIcon.setAttribute("aria-hidden", "true");
  descriptionHeading.append(descriptionIcon);
  const description = createElement("div", "product-detail__description");
  description.id = "product-description-content";
  description.innerHTML =
    sanitizeProductDescription(product.description) ||
    "<p>Descrição do produto em breve.</p>";
  descriptionHeading.addEventListener("click", () => {
    const expanded = descriptionHeading.getAttribute("aria-expanded") === "true";
    descriptionHeading.setAttribute("aria-expanded", String(!expanded));
    description.hidden = expanded;
    descriptionIcon.textContent = expanded ? "+" : "−";
  });
  descriptionPanel.append(descriptionHeading, description);
  const variantsHeading = createElement(
    "h2",
    "product-detail__section-title",
    "ESCOLHA UMA OPÇÃO",
  );
  const variants = createElement("div", "product-detail__variants");
  variants.setAttribute("role", "group");
  variants.setAttribute("aria-label", "Opções cadastradas para este produto");
  const variantChoiceButtons = [];
  const sizeChoiceButtons = new Map();

  const renderGallery = () => {
    const images = currentVariant().images;
    currentImageIndex = Math.min(currentImageIndex, images.length - 1);
    imageTrack.replaceChildren(
      ...images.map((src, index) => {
        const image = document.createElement("img");
        image.src = src;
        image.alt = `${product.name}, imagem ${index + 1}, ${currentVariant().label}`;
        image.loading = index === 0 ? "eager" : "lazy";
        image.decoding = "async";
        image.addEventListener("click", () => {
          currentImageIndex = index;
          renderViewerGallery();
          imageViewer.showModal();
        });
        return image;
      }),
    );
    imageTrack.scrollLeft = imageTrack.clientWidth * currentImageIndex;
  };

  const renderViewerGallery = () => {
    const images = currentVariant().images;
    viewerTrack.replaceChildren(
      ...images.map((src, index) => {
        const image = document.createElement("img");
        image.className = "product-image-viewer__image";
        image.src = src;
        image.alt = `${product.name}, imagem ${index + 1}, ${currentVariant().label}, visualização ampliada`;
        image.loading = index === currentImageIndex ? "eager" : "lazy";
        image.decoding = "async";
        return image;
      }),
    );
    viewerTrack.scrollLeft = viewerTrack.clientWidth * currentImageIndex;
    viewerCounter.textContent = `${currentImageIndex + 1} / ${images.length}`;
  };

  const moveToImage = (index) => {
    const images = currentVariant().images;
    currentImageIndex = (index + images.length) % images.length;
    imageTrack.scrollTo({
      left: imageTrack.clientWidth * currentImageIndex,
      behavior: "smooth",
    });
  };

  imageTrack.addEventListener("scroll", () => {
    if (!imageTrack.clientWidth) return;
    currentImageIndex = Math.min(
      Math.round(imageTrack.scrollLeft / imageTrack.clientWidth),
      currentVariant().images.length - 1,
    );
  });
  previousImage.addEventListener("click", () => moveToImage(currentImageIndex - 1));
  nextImage.addEventListener("click", () => moveToImage(currentImageIndex + 1));
  viewerPrevious.addEventListener("click", () => {
    moveToImage(currentImageIndex - 1);
    renderViewerGallery();
  });
  viewerNext.addEventListener("click", () => {
    moveToImage(currentImageIndex + 1);
    renderViewerGallery();
  });
  viewerTrack.addEventListener("scroll", () => {
    if (!viewerTrack.clientWidth) return;
    currentImageIndex = Math.min(
      Math.round(viewerTrack.scrollLeft / viewerTrack.clientWidth),
      currentVariant().images.length - 1,
    );
    viewerCounter.textContent = `${currentImageIndex + 1} / ${currentVariant().images.length}`;
  });

  product.variants.forEach((variant, index) => {
    const choice = createElement("button", "product-detail__variant");
    choice.type = "button";
    choice.setAttribute(
      "aria-pressed",
      String(variantSelected && index === currentVariantIndex),
    );
    choice.setAttribute("aria-label", `Opção ${variant.label}`);
    const swatch = createElement("span", "product-detail__variant-swatch");
    swatch.style.setProperty("--swatch-color", variant.color);
    const label = createElement("span", "", variant.label);
    choice.append(swatch, label);
    choice.addEventListener("click", () => {
      currentVariantIndex = index;
      variantSelected = true;
      currentImageIndex = 0;
      if (
        selectedSize &&
        !findCheckoutLink(product, variant.id, selectedSize)
      ) {
        selectedSize = null;
        sizeChoiceButtons.forEach((button) =>
          button.setAttribute("aria-pressed", "false"),
        );
      }
      variants.querySelectorAll("button").forEach((button, buttonIndex) => {
        button.setAttribute("aria-pressed", String(buttonIndex === index));
      });
      renderGallery();
      refreshPurchaseState();
    });
    variantChoiceButtons[index] = choice;
    variants.append(choice);
  });

  const addToCartButton = createElement(
    "button",
    "product-detail__add",
    "ADICIONAR À SACOLA",
  );
  let selectedSize = null;
  let quantity = 1;
  let purchaseButton = null;
  let purchaseStatus = null;
  let quantityInput = null;
  let refreshPurchaseState = () => {};

  addToCartButton.type = "button";
  addToCartButton.hidden = true;
  addToCartButton.addEventListener("click", () => {
    if (
      (product.sizeChart && !selectedSize) ||
      !variantSelected ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      !findCheckoutLink(product, currentVariant().id, selectedSize)
    ) {
      return;
    }
    addToCart(product, currentVariantIndex, selectedSize, quantity);
  });

  let sizeSelector = null;
  if (product.sizeChart) {
    sizeSelector = createElement("section", "product-detail__size-selector");
    sizeSelector.id = "tamanhos";
    const sizeHeading = createElement(
      "h2",
      "product-detail__section-title",
      "ESCOLHA SEU TAMANHO (BR)",
    );
    const sizeChoices = createElement("div", "product-detail__sizes");
    sizeChoices.setAttribute("role", "group");
    sizeChoices.setAttribute("aria-label", "Tamanhos brasileiros disponíveis");
    product.sizeChart.forEach((size) => {
      const choice = createElement(
        "button",
        "product-detail__size",
        size.size,
      );
      choice.type = "button";
      choice.setAttribute("aria-pressed", "false");
      choice.addEventListener("click", () => {
        selectedSize = size.size;
        sizeChoices.querySelectorAll("button").forEach((button) => {
          button.setAttribute(
            "aria-pressed",
            String(button === choice),
          );
        });
        refreshPurchaseState();
      });
      sizeChoiceButtons.set(size.size, choice);
      sizeChoices.append(choice);
    });

    const chartToggle = createElement("button", "product-detail__chart-toggle");
    chartToggle.type = "button";
    chartToggle.setAttribute("aria-expanded", "false");
    chartToggle.setAttribute("aria-label", "Ver tabela de medidas");
    const chartLabel = createElement(
      "span",
      "",
      "Tabela de medidas",
    );
    const chartChevron = createElement(
      "span",
      "product-detail__chart-chevron",
      "⌄",
    );
    chartChevron.setAttribute("aria-hidden", "true");
    chartToggle.append(chartLabel, chartChevron);
    const tableWrap = createElement("div", "product-detail__chart-wrap");
    tableWrap.id = "tabela-medidas";
    tableWrap.hidden = true;
    chartToggle.setAttribute("aria-controls", tableWrap.id);
    chartToggle.addEventListener("click", () => {
      const isExpanded = chartToggle.getAttribute("aria-expanded") === "true";
      chartToggle.setAttribute("aria-expanded", String(!isExpanded));
      tableWrap.hidden = isExpanded;
      chartToggle.setAttribute(
        "aria-label",
        isExpanded ? "Ver tabela de medidas" : "Ocultar tabela de medidas",
      );
    });
    const table = document.createElement("table");
    table.className = "product-detail__chart";
    const tableHead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of [
      "Tamanho BR",
      "Busto",
      "Comprimento",
      "Largura dos ombros",
    ]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headerRow.append(cell);
    }
    tableHead.append(headerRow);
    const tableBody = document.createElement("tbody");
    product.sizeChart.forEach((size) => {
      const row = document.createElement("tr");
      for (const value of [
        size.size,
        size.bust,
        size.length,
        size.shoulders,
      ]) {
        const cell = document.createElement("td");
        cell.textContent =
          value === null ? "—" : `${value}${value === size.size ? "" : " cm"}`;
        row.append(cell);
      }
      tableBody.append(row);
    });
    table.append(tableHead, tableBody);
    tableWrap.append(table);
    sizeSelector.append(sizeHeading, sizeChoices, chartToggle, tableWrap);
  }

  const quantitySelector = createElement(
    "div",
    "product-detail__quantity-selector",
  );
  const quantityLabel = createElement(
    "label",
    "product-detail__quantity-label",
    "QUANTIDADE",
  );
  quantityLabel.htmlFor = "product-detail-quantity";
  quantityInput = document.createElement("input");
  quantityInput.id = "product-detail-quantity";
  quantityInput.type = "number";
  quantityInput.min = "1";
  quantityInput.max = String(Number.MAX_SAFE_INTEGER);
  quantityInput.step = "1";
  quantityInput.value = String(quantity);
  quantityInput.setAttribute("aria-label", `Quantidade de ${product.name}`);
  const quantityControls = createElement(
    "div",
    "product-detail__quantity-controls",
  );
  const quantityDecrease = createElement(
    "button",
    "product-detail__quantity-change",
    "−",
  );
  quantityDecrease.type = "button";
  quantityDecrease.setAttribute("aria-label", "Diminuir quantidade");
  quantityDecrease.addEventListener("click", () => {
    const currentQuantity = Number(quantityInput.value);
    if (Number.isSafeInteger(currentQuantity) && currentQuantity > 1) {
      quantityInput.value = String(currentQuantity - 1);
      quantity = currentQuantity - 1;
      addToCartButton.disabled =
        Boolean(product.sizeChart && !selectedSize) ||
        !Number.isSafeInteger(quantity);
      refreshPurchaseState();
    }
  });
  const quantityIncrease = createElement(
    "button",
    "product-detail__quantity-change",
    "+",
  );
  quantityIncrease.type = "button";
  quantityIncrease.setAttribute("aria-label", "Aumentar quantidade");
  quantityIncrease.addEventListener("click", () => {
    const currentQuantity = Number(quantityInput.value);
    if (
      Number.isSafeInteger(currentQuantity) &&
      currentQuantity < Number.MAX_SAFE_INTEGER
    ) {
      quantityInput.value = String(currentQuantity + 1);
      quantity = currentQuantity + 1;
      addToCartButton.disabled =
        Boolean(product.sizeChart && !selectedSize) ||
        !Number.isSafeInteger(quantity);
      refreshPurchaseState();
    }
  });
  quantityInput.addEventListener("input", () => {
    quantity = Number(quantityInput.value);
    addToCartButton.disabled =
      (Boolean(product.sizeChart) && !selectedSize) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1;
    refreshPurchaseState();
  });
  quantityControls.append(quantityDecrease, quantityInput, quantityIncrease);
  quantitySelector.append(quantityLabel, quantityControls);

  purchaseButton = createElement(
    "button",
    "product-detail__purchase is-unavailable",
    product.variants.length > 1 && !variantSelected
      ? "ESCOLHA A COR"
      : product.sizeChart
        ? "ESCOLHA UM TAMANHO"
        : "CHECKOUT INDISPONÍVEL",
  );
  purchaseButton.type = "button";
  purchaseButton.disabled = true;
  purchaseStatus = createElement(
    "p",
    "product-detail__purchase-status",
    "Escolha as opções do produto antes de comprar.",
  );
  purchaseStatus.setAttribute("role", "status");
  purchaseStatus.setAttribute("aria-live", "polite");
  purchaseButton.addEventListener("click", () => {
    try {
      window.location.assign(
        getYampiCheckoutUrl(
          product,
          currentVariant().id,
          selectedSize,
          quantity,
        ),
      );
    } catch (error) {
      console.error("Não foi possível iniciar o checkout Yampi:", error);
      purchaseStatus.textContent = error.message;
    }
  });

  refreshPurchaseState = () => {
    if (root.hidden || root.dataset.productId !== product.id) return;

    const quantityIsValid =
      Number.isSafeInteger(quantity) && quantity >= 1;
    const colorIsSelected =
      product.variants.length === 1 || variantSelected;
    const sizeIsSelected = !product.sizeChart || Boolean(selectedSize);
    const checkoutLink = findCheckoutLink(
      product,
      currentVariant().id,
      selectedSize,
    );
    const variantIsAvailable = product.sizeChart
      ? product.sizeChart.some((size) =>
          findCheckoutLink(product, currentVariant().id, size.size),
        )
      : Boolean(checkoutLink);
    const purchaseAvailable =
      colorIsSelected &&
      Boolean(checkoutLink) &&
      sizeIsSelected &&
      quantityIsValid;
    const anyVariantAvailable = product.variants.some((variant) =>
      product.sizeChart
        ? product.sizeChart.some((size) =>
            findCheckoutLink(product, variant.id, size.size),
          )
        : Boolean(findCheckoutLink(product, variant.id, null)),
    );
    variantChoiceButtons.forEach((button, index) => {
      const variant = product.variants[index];
      const available = product.sizeChart
        ? product.sizeChart.some((size) =>
            findCheckoutLink(product, variant.id, size.size),
          )
        : Boolean(findCheckoutLink(product, variant.id, null));
      button.disabled = !available;
      button.title = available
        ? ""
        : "Cadastre o link de checkout desta cor no painel";
    });
    sizeChoiceButtons.forEach((button, size) => {
      const available = Boolean(
        findCheckoutLink(product, currentVariant().id, size),
      );
      button.disabled = !available || !colorIsSelected;
      button.title = available
        ? ""
        : "Cadastre o link de checkout desta combinação no painel";
    });

    addToCartButton.disabled = !purchaseAvailable;
    addToCartButton.hidden = false;

    purchaseButton.disabled = !purchaseAvailable;
    purchaseButton.classList.toggle("is-unavailable", !purchaseAvailable);
    purchaseButton.textContent = purchaseAvailable
      ? "COMPRAR AGORA ↗"
      : !colorIsSelected
        ? anyVariantAvailable
          ? "ESCOLHA A COR"
          : "OPÇÃO INDISPONÍVEL"
        : !variantIsAvailable
          ? "OPÇÃO INDISPONÍVEL"
          : product.sizeChart && !selectedSize
          ? "ESCOLHA UM TAMANHO"
          : !checkoutLink
            ? "OPÇÃO INDISPONÍVEL"
            : "INFORME A QUANTIDADE";
    const purchaseLabel = !colorIsSelected
      ? anyVariantAvailable
        ? "ESCOLHA A COR"
        : "INDISPONÍVEL"
      : !variantIsAvailable
        ? "INDISPONÍVEL"
        : product.sizeChart && !selectedSize
        ? "ESCOLHA O TAMANHO"
        : !checkoutLink
          ? "INDISPONÍVEL"
        : !quantityIsValid
          ? "INFORME A QUANTIDADE"
          : "INDISPONÍVEL";
    const selectionSummary = [
      colorIsSelected ? currentVariant().label : "Escolha uma cor",
      product.sizeChart
        ? selectedSize
          ? `Tamanho ${selectedSize}`
          : "Escolha o tamanho"
        : null,
      `Qtd. ${quantityInput.value}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const onMobilePurchaseAction = () => {
      if (purchaseAvailable) {
        purchaseButton.click();
      } else if (!colorIsSelected && anyVariantAvailable) {
        variants.scrollIntoView({ behavior: "smooth", block: "center" });
        variantChoiceButtons.find((button) => !button.disabled)?.focus({
          preventScroll: true,
        });
      } else if (variantIsAvailable && product.sizeChart && !selectedSize) {
        sizeSelector.scrollIntoView({ behavior: "smooth", block: "center" });
        for (const button of sizeChoiceButtons.values()) {
          if (!button.disabled) {
            button.focus({ preventScroll: true });
            break;
          }
        }
      }
    };

    if (!colorIsSelected) {
      purchaseStatus.textContent = "Escolha uma cor antes de comprar.";
    } else if (!variantIsAvailable) {
      purchaseStatus.textContent = "Esta opção está indisponível para compra.";
    } else if (product.sizeChart && !selectedSize) {
      purchaseStatus.textContent = "Escolha um tamanho antes de comprar.";
    } else if (!quantityIsValid) {
      purchaseStatus.textContent =
        "Informe uma quantidade inteira maior que zero.";
    } else if (!purchaseAvailable) {
      purchaseStatus.textContent =
        "Cadastre o link Yampi para esta combinação no painel.";
    } else {
      purchaseStatus.textContent =
        "O checkout desta combinação abrirá na Yampi.";
    }

    updateMobilePurchaseBar(
      product,
      quantityInput.value,
      purchaseAvailable,
      onMobilePurchaseAction,
      purchaseLabel,
      selectionSummary,
    );
  };
  refreshPurchaseState();

  renderGallery();
  productHeader.append(eyebrow, title);
  gallery.append(mainImageFrame);
  info.append(
    productHeader,
    rating,
    price,
    variantsHeading,
    variants,
  );
  if (sizeSelector) info.append(sizeSelector);
  info.append(quantitySelector);
  info.append(addToCartButton, createProductCouponCarousel());
  info.append(purchaseButton, purchaseStatus);
  layout.append(gallery, info);
  content.append(
    topbar,
    breadcrumbs,
    backButton,
    layout,
    descriptionPanel,
    createRecommendations(product),
    imageViewer,
  );
  root.replaceChildren(content);
  root.hidden = false;
  root.dataset.productId = product.id;
  store.classList.add("is-product-detail");
  productDetailsVisible = true;
  refreshPurchaseState();
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

function restoreCartTrigger() {
  const cartTrigger = document.querySelector("#cart-trigger");
  const header = document.querySelector(".site-header");
  if (cartTrigger && header) header.append(cartTrigger);
}

function syncProductRoute() {
  const productId = getProductIdFromLocation();
  const categoryMatch = window.location.hash.match(/^#categoria\/([a-z0-9-]+)$/);
  const categoryId = categoryMatch?.[1] ?? null;
  const store = document.querySelector("#store");
  const root = document.querySelector("#product-detail");
  if (!store || !root || store.hidden) return;
  document.title = "REHVA | Moda feminina";

  const categoryPage = document.querySelector("#category-page");
  const kitBuilder = document.querySelector("#kit-builder");
  if (window.location.hash === "#kits") {
    if (!kitBuilderSettings.enabled) {
      window.history.replaceState({}, "", "#inicio");
    } else if (renderKitBuilderPage()) {
      root.hidden = true;
      categoryPage.hidden = true;
      kitBuilder.hidden = false;
      document.querySelector("#category-banners").hidden = true;
      document.querySelector("#colecao").hidden = true;
      document.querySelector(".hero").hidden = true;
      document.querySelector(".site-footer").hidden = true;
      store.classList.remove("is-category-page", "is-product-detail");
      store.classList.add("is-kit-page");
      document.title = `${kitBuilderSettings.title} | REHVA`;
      const mobilePurchaseBar = document.querySelector("#mobile-purchase-bar");
      if (mobilePurchaseBar) mobilePurchaseBar.hidden = true;
      document.body.classList.remove("has-mobile-purchase-bar");
      window.scrollTo(0, 0);
      return;
    }
  }
  kitBuilder.hidden = true;
  store.classList.remove("is-kit-page");
  if (categoryId && renderCategoryPage(categoryId)) {
    restoreCartTrigger();
    root.hidden = true;
    document.querySelector("#category-banners").hidden = true;
    document.querySelector("#colecao").hidden = true;
    document.querySelector(".hero").hidden = true;
    document.querySelector(".site-footer").hidden = true;
    store.classList.add("is-category-page");
    window.scrollTo(0, 0);
    return;
  }
  if (categoryPage) categoryPage.hidden = true;
  kitBuilder.hidden = true;
  document.querySelector("#category-banners").hidden = false;
  document.querySelector("#colecao").hidden = false;
  document.querySelector(".hero").hidden = false;
  document.querySelector(".site-footer").hidden = false;
  store.classList.remove("is-category-page");

  if (productId) {
    const product = products.find((item) => item.id === productId);
    if (product) {
      if (root.dataset.productId === productId && !root.hidden) return;
      renderProductDetails(productId);
      return;
    }
  }

  root.hidden = true;
  restoreCartTrigger();
  root.replaceChildren();
  delete root.dataset.productId;
  store.classList.remove("is-product-detail");
  const mobilePurchaseBar = document.querySelector("#mobile-purchase-bar");
  if (mobilePurchaseBar) mobilePurchaseBar.hidden = true;
  document.body.classList.remove("has-mobile-purchase-bar");
  if (productDetailsVisible) {
    productDetailsVisible = false;
    window.scrollTo(0, productDetailsReturnScrollY ?? 0);
    productDetailsReturnScrollY = null;
  }
}

function openProductDetails(
  product,
  variantIndex,
  variantSelected = false,
) {
  productDetailsReturnScrollY = window.scrollY;
  window.history.pushState(
    { rehvaProductId: product.id },
    "",
    `#produto/${product.id}`,
  );
  renderProductDetails(product.id, variantIndex, variantSelected);
}

export async function mountProductCards(container) {
  if (!container) return;
  const catalog = await getCatalog();
  const applyCatalog = (nextCatalog) => {
    if (
      !Array.isArray(nextCatalog.products) ||
      !Array.isArray(nextCatalog.categories) ||
      !nextCatalog.settings
    ) {
      throw new Error("O catálogo recebido está incompleto.");
    }
    products = nextCatalog.products.map(normalizeProduct);
    applyStoreSettings(nextCatalog.settings);
    restoreKitItems();
    categories = nextCatalog.categories.map((category) => ({
      ...category,
      kind:
        category.kind ||
        (category.desktopImage || category.mobileImage ? "banner" : "filter"),
      desktopImage: category.desktopImage || nextCatalog.settings.heroImage,
      mobileImage:
        category.mobileImage ||
        category.desktopImage ||
        nextCatalog.settings.heroImage,
      title: category.title || category.name,
      subtitle: category.subtitle || "",
      buttonLabel: category.buttonLabel || "VER COLEÇÃO",
    }));
    if (!categories.some((category) => category.id === activeCategoryId)) {
      activeCategoryId = "all";
    }
    renderCategoryFilters();
    renderCategoryBanners();
    renderComboShowcase();
    renderProductGrid();
    syncProductRoute();
  };
  applyCatalog(catalog);
  watchCatalog(applyCatalog);
  const adminLink = document.querySelector(".admin-link");
  if (adminLink) {
    adminLink.hidden = !["localhost", "127.0.0.1", "::1"].includes(
      window.location.hostname,
    );
  }
  initializeCart();
  window.addEventListener("popstate", syncProductRoute);
  window.addEventListener("hashchange", syncProductRoute);
  window.requestAnimationFrame(syncProductRoute);
}
