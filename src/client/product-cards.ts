// @ts-nocheck
import { getCatalog, watchCatalog } from "./firebase";

let products = [
  {
    id: "rehva-look-1",
    name: "Look REHVA 01",
    priceCents: 12990,
    checkoutUrl: "https://reahva.pay.yampi.com.br/r/8ZQNKE68YV",
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

function createPurchaseAction(
  product,
  className,
  label = "COMPRAR ↗",
  { requiresSize = false, getSelectedSize = () => null } = {},
) {
  if (!product.checkoutUrl) {
    const unavailable = createElement(
      "button",
      `${className} is-unavailable`,
      "CHECKOUT EM BREVE",
    );
    unavailable.type = "button";
    unavailable.disabled = true;
    unavailable.setAttribute(
      "aria-label",
      `Checkout de ${product.name} ainda não configurado`,
    );
    return unavailable;
  }

  if (requiresSize) {
    const button = createElement(
      "button",
      className,
      getSelectedSize() ? label : "ESCOLHA O TAMANHO",
    );
    button.type = "button";
    button.setAttribute(
      "aria-label",
      getSelectedSize()
        ? `Comprar ${product.name} — abre o checkout em outra aba`
        : "Escolha um tamanho brasileiro antes de comprar",
    );
    button.addEventListener("click", () => {
      if (!getSelectedSize()) {
        document.querySelector("#tamanhos")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        return;
      }
      window.open(product.checkoutUrl, "_blank", "noopener,noreferrer");
    });
    return button;
  }

  const link = createElement("a", className, label);
  link.href = product.checkoutUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute(
    "aria-label",
    `Comprar ${product.name} — abre o checkout em outra aba`,
  );
  return link;
}

function updateMobilePurchaseBar(product, selectedSize = null) {
  let bar = document.querySelector("#mobile-purchase-bar");
  if (!bar) {
    bar = createElement("div", "mobile-purchase-bar");
    bar.id = "mobile-purchase-bar";
    bar.setAttribute("aria-label", "Compra rápida");
    document.body.append(bar);
  }

  const summary = createElement("div", "mobile-purchase-bar__summary");
  summary.append(createPriceDisplay(product, "mobile-purchase-bar__price"));
  const requiresSize = Array.isArray(product.sizeChart);
  if (requiresSize) {
    summary.append(
      createElement(
        "span",
        "mobile-purchase-bar__size",
        selectedSize ? `Tamanho ${selectedSize}` : "Escolha seu tamanho BR",
      ),
    );
  }
  const action = createPurchaseAction(
    product,
    "mobile-purchase-bar__action",
    "COMPRAR ↗",
    { requiresSize, getSelectedSize: () => selectedSize },
  );
  bar.replaceChildren(summary, action);
  bar.hidden = false;
  document.body.classList.add("has-mobile-purchase-bar");
}

function applyStoreSettings(settings) {
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

  const promoCodeButton = document.querySelector("#promo-code");
  promoCodeButton.dataset.code = settings.promoCode;
  promoCodeButton.dataset.percent = String(settings.promoPercent);
  promoCodeButton.setAttribute(
    "aria-label",
    `Copiar cupom ${settings.promoCode} para ${settings.promoPercent}% de desconto`,
  );
  document.querySelector("#promo-eyebrow").textContent =
    `UM PRESENTE ${settings.storeName.toLocaleUpperCase("pt-BR")}`;
  document.querySelector("#promo-offer").textContent =
    `${settings.promoPercent}% OFF`;
  document.querySelector("#promo-code-label").textContent = settings.promoCode;
}

const formatPrice = (priceCents) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(priceCents / 100);

function addToCart(product, variantIndex, selectedSize = null) {
  const variant = product.variants[variantIndex];
  const key = `${product.id}:${variant.id}:${selectedSize ?? ""}`;
  const existingItem = cartItems.get(key);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.set(key, {
      productId: product.id,
      variantId: variant.id,
      variantIndex,
      size: selectedSize,
      quantity: 1,
    });
  }
  persistCart();
  renderCart();
  const feedback = document.querySelector("#cart-feedback");
  if (feedback) {
    const sizeLabel = selectedSize ? `, tamanho ${selectedSize}` : "";
    feedback.textContent = `${product.name}, opção ${variant.label}${sizeLabel}, adicionado à sacola.`;
  }
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
  const notice = document.querySelector("#cart-notice");
  const checkout = document.querySelector("#cart-checkout");
  if (!count || !itemsRoot || !totalRoot || !notice || !checkout) return;

  const entries = [...cartItems.entries()];
  const quantity = entries.reduce((sum, [, item]) => sum + item.quantity, 0);
  const total = entries.reduce((sum, [, item]) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + (product ? getCurrentPriceCents(product) : 0) * item.quantity;
  }, 0);
  count.textContent = String(quantity);
  count.setAttribute("aria-label", `${quantity} ${quantity === 1 ? "item" : "itens"}`);
  totalRoot.textContent = formatPrice(total);
  itemsRoot.replaceChildren();

  if (entries.length === 0) {
    itemsRoot.append(
      createElement("p", "cart-dialog__empty", "Sua sacola está vazia."),
    );
    notice.textContent = "";
    checkout.hidden = true;
    return;
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
    info.append(name, variantLabel, price, controls);
    row.append(image, info);
    itemsRoot.append(row);
  }

  const singleItem = entries.length === 1 ? entries[0][1] : null;
  const checkoutProduct = singleItem
    ? products.find((entry) => entry.id === singleItem.productId)
    : null;
  const checkoutAvailable =
    singleItem?.quantity === 1 && Boolean(checkoutProduct?.checkoutUrl);

  if (checkoutAvailable) {
    checkout.href = checkoutProduct.checkoutUrl;
    checkout.target = "_blank";
    checkout.rel = "noopener noreferrer";
    checkout.hidden = false;
    notice.textContent = "";
  } else {
    checkout.hidden = true;
    notice.textContent =
      "A finalização do carrinho será configurada quando os links de checkout estiverem disponíveis.";
  }
}

function initializeCart() {
  if (cartInitialized) return;
  const dialog = document.querySelector("#cart-dialog");
  const trigger = document.querySelector("#cart-trigger");
  const close = document.querySelector("#cart-close");
  if (!dialog || !trigger || !close) return;

  trigger.addEventListener("click", () => {
    renderCart();
    dialog.showModal();
  });
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  cartInitialized = true;
  restoreCart();
  renderCart();
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

  product.variants.forEach((variant, variantIndex) => {
    const swatch = document.createElement("button");
    swatch.className = "product-card__swatch";
    swatch.type = "button";
    swatch.style.setProperty("--swatch-color", variant.color);
    swatch.setAttribute("aria-label", `${variant.label}, produto ${productIndex + 1}`);
    swatch.setAttribute("aria-pressed", variantIndex === 0 ? "true" : "false");
    swatch.title = variant.label;

    const selectVariant = () => {
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
    swatch.addEventListener("pointerenter", selectVariant);
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
    );
  });

  media.addEventListener("click", () => {
    openProductDetails(
      product,
      Number(card.dataset.activeVariant ?? 0),
    );
  });

  const purchaseRow = createElement("div", "product-card__purchase-row");
  const price = createPriceDisplay(product, "product-card__price");
  const addButton = createElement("button", "product-card__add", "＋ Sacola");
  addButton.type = "button";
  if (product.sizeChart) {
    addButton.textContent = "ESCOLHER TAM.";
  }
  addButton.setAttribute(
    "aria-label",
    product.sizeChart
      ? `Escolher tamanho de ${product.name}`
      : `Adicionar ${product.name} à sacola`,
  );
  addButton.addEventListener("click", () => {
    const variantIndex = Number(card.dataset.activeVariant ?? 0);
    if (product.sizeChart) {
      openProductDetails(product, variantIndex);
      return;
    }
    addToCart(product, variantIndex);
  });
  const actions = createElement("div", "product-card__actions");
  const purchaseButton = createPurchaseAction(
    product,
    "product-card__buy",
  );
  actions.append(purchaseButton, addButton);
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

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function getProductIdFromLocation() {
  const match = window.location.hash.match(/^#produto\/([a-z0-9-]+)$/);
  return match?.[1] ?? null;
}

function renderProductDetails(productId, preferredVariant = 0) {
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
  let currentImageIndex = 0;
  const currentVariant = () => product.variants[currentVariantIndex];

  const content = createElement("div", "product-detail__inner");
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
    "h2",
    "product-detail__description-heading",
    "Descrição do produto",
  );
  const description = createElement("div", "product-detail__description");
  description.textContent =
    getDescriptionText(product.description) || "Descrição do produto em breve.";
  descriptionPanel.append(descriptionHeading, description);
  const variantsHeading = createElement(
    "h2",
    "product-detail__section-title",
    "ESCOLHA UMA OPÇÃO",
  );
  const variants = createElement("div", "product-detail__variants");
  variants.setAttribute("role", "group");
  variants.setAttribute("aria-label", "Opções cadastradas para este produto");

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
    choice.setAttribute("aria-pressed", String(index === currentVariantIndex));
    choice.setAttribute("aria-label", `Opção ${variant.label}`);
    const swatch = createElement("span", "product-detail__variant-swatch");
    swatch.style.setProperty("--swatch-color", variant.color);
    const label = createElement("span", "", variant.label);
    choice.append(swatch, label);
    choice.addEventListener("click", () => {
      currentVariantIndex = index;
      currentImageIndex = 0;
      variants.querySelectorAll("button").forEach((button, buttonIndex) => {
        button.setAttribute("aria-pressed", String(buttonIndex === index));
      });
      renderGallery();
    });
    variants.append(choice);
  });

  const addToCartButton = createElement(
    "button",
    "product-detail__add",
    "ADICIONAR À SACOLA",
  );
  addToCartButton.type = "button";
  addToCartButton.disabled = Boolean(product.sizeChart);
  if (product.sizeChart) addToCartButton.textContent = "ESCOLHA O TAMANHO";
  addToCartButton.addEventListener("click", () => {
    if (product.sizeChart && !selectedSize) return;
    addToCart(product, currentVariantIndex, selectedSize);
  });

  let selectedSize = null;
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
        addToCartButton.disabled = false;
        addToCartButton.textContent = "ADICIONAR À SACOLA";
        if (
          purchaseButton instanceof HTMLButtonElement &&
          product.checkoutUrl
        ) {
          purchaseButton.textContent = "COMPRAR AGORA ↗";
          purchaseButton.setAttribute(
            "aria-label",
            `Comprar ${product.name} — abre o checkout em outra aba`,
          );
        }
        updateMobilePurchaseBar(product, selectedSize);
      });
      sizeChoices.append(choice);
    });

    const chartHeading = createElement(
      "h3",
      "product-detail__chart-heading",
      "Tabela de medidas (cm)",
    );
    const tableWrap = createElement("div", "product-detail__chart-wrap");
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
    sizeSelector.append(sizeHeading, sizeChoices, chartHeading, tableWrap);
  }

  const purchaseButton = createPurchaseAction(
    product,
    "product-detail__purchase",
    product.checkoutUrl ? "COMPRAR AGORA ↗" : "CHECKOUT EM BREVE",
    {
      requiresSize: Boolean(product.sizeChart),
      getSelectedSize: () => selectedSize,
    },
  );

  renderGallery();
  productHeader.append(eyebrow, title);
  gallery.append(mainImageFrame);
  info.append(
    rating,
    price,
    variantsHeading,
    variants,
  );
  if (sizeSelector) info.append(sizeSelector);
  info.append(addToCartButton);
  info.append(purchaseButton);
  layout.append(gallery, info);
  content.append(
    breadcrumbs,
    backButton,
    productHeader,
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
  updateMobilePurchaseBar(product, selectedSize);
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

function syncProductRoute() {
  const productId = getProductIdFromLocation();
  const categoryMatch = window.location.hash.match(/^#categoria\/([a-z0-9-]+)$/);
  const categoryId = categoryMatch?.[1] ?? null;
  const store = document.querySelector("#store");
  const root = document.querySelector("#product-detail");
  if (!store || !root || store.hidden) return;

  const categoryPage = document.querySelector("#category-page");
  if (categoryId && renderCategoryPage(categoryId)) {
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

function openProductDetails(product, variantIndex) {
  productDetailsReturnScrollY = window.scrollY;
  window.history.pushState(
    { rehvaProductId: product.id },
    "",
    `#produto/${product.id}`,
  );
  renderProductDetails(product.id, variantIndex);
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
    applyStoreSettings(nextCatalog.settings);
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
