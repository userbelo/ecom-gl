// @ts-nocheck
import {
  getCatalog,
  login,
  logout,
  saveCatalog,
  watchAuth,
} from "./firebase";

const adminStatus = document.querySelector("#admin-status");
const productList = document.querySelector("#product-list");
const productForm = document.querySelector("#product-form");
const productEmpty = document.querySelector("#product-empty");
const productFields = document.querySelector("#product-fields");
const categoryList = document.querySelector("#category-list");
const variantEditorList = document.querySelector("#variant-editor-list");
const authScreen = document.querySelector("#admin-auth");
const adminApp = document.querySelector("#admin-content");
const authForm = document.querySelector("#admin-auth-form");
const authError = document.querySelector("#admin-auth-error");
const logoutButton = document.querySelector("#admin-logout");
let catalog;
let selectedProductId = null;
let statusTimeout;

function createDefaultSizeChart() {
  return [
    { size: "P", bust: 80, length: 48, shoulders: 38 },
    { size: "M", bust: 84, length: 49, shoulders: 39 },
    { size: "G", bust: 88, length: 50, shoulders: 40 },
    { size: "GG", bust: 92, length: 51, shoulders: 41 },
    { size: "EG", bust: 96, length: 52, shoulders: 42 },
  ];
}

function setStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("is-error", isError);
  window.clearTimeout(statusTimeout);
  statusTimeout = window.setTimeout(() => {
    adminStatus.textContent = "";
    adminStatus.classList.remove("is-error");
  }, 5000);
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
}

function createElement(tag, className = "", text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function formatPrice(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getSelectedProduct() {
  return catalog.products.find((product) => product.id === selectedProductId);
}

function renderSizeChart(product) {
  const rows = document.querySelector("#size-chart-rows");
  rows.replaceChildren(
    ...product.sizeChart.map((size, index) => {
      const row = document.createElement("tr");
      const sizeCell = document.createElement("td");
      const sizeInput = document.createElement("input");
      sizeInput.type = "text";
      sizeInput.maxLength = 20;
      sizeInput.required = true;
      sizeInput.value = size.size;
      sizeInput.setAttribute("aria-label", `Tamanho BR da linha ${index + 1}`);
      sizeInput.addEventListener("input", () => {
        size.size = sizeInput.value;
      });
      sizeCell.append(sizeInput);
      row.append(sizeCell);

      for (const [key, label] of [
        ["bust", "Busto"],
        ["length", "Comprimento"],
        ["shoulders", "Largura dos ombros"],
      ]) {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "300";
        input.step = "0.1";
        input.value = size[key] ?? "";
        input.setAttribute(
          "aria-label",
          `${label} em centímetros para tamanho ${size.size || index + 1}`,
        );
        input.addEventListener("input", () => {
          size[key] = input.value === "" ? null : Number(input.value);
        });
        cell.append(input);
        row.append(cell);
      }

      const actionCell = document.createElement("td");
      const remove = createElement(
        "button",
        "variant-editor__remove-image",
        "REMOVER",
      );
      remove.type = "button";
      remove.disabled = product.sizeChart.length <= 1;
      remove.setAttribute(
        "aria-label",
        `Remover tamanho ${size.size || index + 1}`,
      );
      remove.addEventListener("click", () => {
        if (product.sizeChart.length <= 1) return;
        product.sizeChart.splice(index, 1);
        renderSizeChart(product);
      });
      actionCell.append(remove);
      row.append(actionCell);
      return row;
    }),
  );
}

function renderProductList() {
  productList.replaceChildren();
  document.querySelector("#product-count").textContent = String(
    catalog.products.length,
  );

  catalog.products.forEach((product) => {
    const button = createElement("button", "product-list__item");
    button.type = "button";
    button.classList.toggle("is-active", product.id === selectedProductId);
    const image = document.createElement("img");
    image.src = product.variants[0]?.images[0] || "";
    image.alt = "";
    const info = createElement("span");
    const name = createElement("strong", "", product.name);
    const displayedPrice =
      product.promotionalPriceCents ?? product.priceCents;
    if (product.promotionalPriceCents != null) {
      const oldPrice = createElement(
        "small",
        "product-list__old-price",
        formatPrice(product.priceCents),
      );
      oldPrice.style.textDecoration = "line-through";
      info.append(name, oldPrice);
    } else {
      info.append(name);
    }
    const price = createElement(
      "small",
      product.promotionalPriceCents != null
        ? "product-list__sale-price"
        : "",
      formatPrice(displayedPrice),
    );
    info.append(price);
    button.append(image, info);
    button.addEventListener("click", () => selectProduct(product.id));
    productList.append(button);
  });
}

function renderProductEditor() {
  const product = getSelectedProduct();
  productEmpty.hidden = Boolean(product);
  productFields.hidden = !product;
  if (!product) return;

  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-name").value = product.name;
  document.querySelector("#product-price").value = (product.priceCents / 100)
    .toFixed(2)
    .replace(".", ",");
  document.querySelector("#product-promotional-price").value =
    product.promotionalPriceCents == null
      ? ""
      : (product.promotionalPriceCents / 100).toFixed(2).replace(".", ",");
  document.querySelector("#product-description").value = product.description;
  document.querySelector("#product-checkout").value = product.checkoutUrl;
  document.querySelector("#product-supplier-url").value =
    product.supplierUrl ?? "";
  const hasSizes = Array.isArray(product.sizeChart);
  document.querySelector("#product-has-sizes").checked = hasSizes;
  document.querySelector("#size-chart-editor").hidden = !hasSizes;
  if (hasSizes) renderSizeChart(product);

  const categorySelect = document.querySelector("#product-category");
  categorySelect.replaceChildren(
    ...catalog.categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      option.selected = category.id === product.categoryId;
      return option;
    }),
  );
  renderVariants(product);
}

function renderVariants(product) {
  variantEditorList.replaceChildren();
  product.variants.forEach((variant, index) => {
    const card = createElement("section", "variant-editor");
    const header = createElement("div", "variant-editor__header");
    const title = createElement("strong", "", `OPÇÃO ${index + 1}`);
    const remove = createElement("button", "variant-editor__remove", "REMOVER");
    remove.type = "button";
    remove.disabled = product.variants.length <= 1;
    remove.addEventListener("click", () => {
      if (product.variants.length <= 1) return;
      product.variants.splice(index, 1);
      renderVariants(product);
    });
    header.append(title, remove);

    const fields = createElement("div", "variant-fields");
    const nameField = createElement("label", "field");
    nameField.append(createElement("span", "", "Nome da cor/opção"));
    const nameInput = document.createElement("input");
    nameInput.value = variant.label;
    nameInput.maxLength = 80;
    nameInput.required = true;
    nameInput.addEventListener("input", () => {
      variant.label = nameInput.value;
      variant.id = slugify(nameInput.value) || `opcao-${index + 1}`;
    });
    nameField.append(nameInput);

    const colorField = createElement("label", "field");
    colorField.append(createElement("span", "", "Cor"));
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = /^#[0-9a-f]{6}$/i.test(variant.color)
      ? variant.color
      : "#f20b83";
    colorInput.addEventListener("input", () => {
      variant.color = colorInput.value;
    });
    colorField.append(colorInput);
    fields.append(nameField, colorField);

    const imageFields = createElement("div", "variant-images");
    variant.images.forEach((imageUrl, imageIndex) => {
      const field = createElement("div", "image-upload");
      field.append(createElement("span", "", `FOTO ${imageIndex + 1}`));
      const preview = document.createElement("img");
      preview.src = imageUrl;
      preview.alt = `Prévia da imagem ${imageIndex + 1}, opção ${variant.label}`;
      const urlInput = document.createElement("input");
      urlInput.type = "text";
      urlInput.inputMode = "url";
      urlInput.maxLength = 2048;
      urlInput.setAttribute(
        "aria-label",
        `URL da imagem ${imageIndex + 1} para ${variant.label}`,
      );
      urlInput.value = imageUrl;
      urlInput.placeholder = "URL da imagem";
      urlInput.required = true;
      urlInput.addEventListener("input", () => {
        variant.images[imageIndex] = urlInput.value.trim();
        preview.src = urlInput.value;
      });
      const removeImage = createElement(
        "button",
        "variant-editor__remove-image",
        "REMOVER FOTO",
      );
      removeImage.type = "button";
      removeImage.disabled = variant.images.length <= 1;
      removeImage.setAttribute(
        "aria-label",
        `Remover imagem ${imageIndex + 1} da opção ${variant.label}`,
      );
      removeImage.addEventListener("click", () => {
        if (variant.images.length <= 1) return;
        variant.images.splice(imageIndex, 1);
        renderVariants(product);
      });
      field.append(preview, urlInput, removeImage);
      imageFields.append(field);
    });

    const addImage = createElement(
      "button",
      "button button--secondary variant-editor__add-image",
      `＋ Adicionar foto (${variant.images.length}/20)`,
    );
    addImage.type = "button";
    addImage.disabled = variant.images.length >= 20;
    addImage.addEventListener("click", () => {
      if (variant.images.length >= 20) {
        setStatus("Cada opção pode ter no máximo 20 fotos.", true);
        return;
      }
      variant.images.push("");
      renderVariants(product);
    });
    card.append(header, fields, imageFields, addImage);
    variantEditorList.append(card);
  });
}

function selectProduct(productId) {
  selectedProductId = productId;
  renderProductList();
  renderProductEditor();
}

function renderCategories() {
  categoryList.replaceChildren();
  catalog.categories.forEach((category) => {
    const row = createElement("div", "category-row");
    const name = createElement("strong", "", category.name);
    const usageCount = catalog.products.filter(
      (product) => product.categoryId === category.id,
    ).length;
    const usage = createElement(
      "small",
      "",
      `${usageCount} ${usageCount === 1 ? "produto" : "produtos"}`,
    );
    const actions = createElement("div", "category-row__actions");
    const rename = document.createElement("input");
    rename.value = category.name;
    rename.maxLength = 80;
    rename.setAttribute("aria-label", `Nome da categoria ${category.name}`);
    const saveName = createElement("button", "", "SALVAR NOME");
    saveName.type = "button";
    saveName.addEventListener("click", async () => {
      const nextName = rename.value.trim();
      if (!nextName) {
        setStatus("Informe um nome para a categoria.", true);
        return;
      }
      category.name = nextName;
      await persistCatalog("Nome da categoria atualizado.");
    });
    const remove = createElement("button", "", "EXCLUIR");
    remove.type = "button";
    remove.disabled = usageCount > 0;
    remove.title = usageCount
      ? "Mova os produtos desta categoria antes de excluí-la."
      : "Excluir categoria";
    remove.addEventListener("click", async () => {
      if (usageCount > 0) return;
      if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return;
      catalog.categories = catalog.categories.filter(
        (entry) => entry.id !== category.id,
      );
      await persistCatalog("Categoria removida.");
    });
    actions.append(saveName, remove);
    row.append(name, usage, rename, actions);
    categoryList.append(row);
  });
}

function readPriceCents(value) {
  const normalized = value.trim().replace(/\s/g, "").includes(",")
    ? value.trim().replace(/\./g, "").replace(",", ".")
    : value.trim();
  const price = Number(normalized);
  if (!Number.isFinite(price) || price < 0 || price > 10000000) {
    throw new Error("Informe um preço válido em reais.");
  }
  return Math.round(price * 100);
}

function extractCheckoutUrl(input) {
  const value = input.trim();
  let checkoutUrl = value;
  if (value.includes("<")) {
    const document = new DOMParser().parseFromString(value, "text/html");
    const anchor = document.querySelector("a[href]");
    if (!anchor) {
      throw new Error("Não encontrei um link no código HTML do botão Yampi.");
    }
    checkoutUrl = anchor.getAttribute("href") || "";
  }
  if (!checkoutUrl) return "";

  let parsedUrl;
  try {
    parsedUrl = new URL(checkoutUrl);
  } catch {
    throw new Error("Informe um link HTTPS válido ou o HTML de um botão com link.");
  }
  if (parsedUrl.protocol !== "https:") {
    throw new Error("O checkout precisa usar um endereço HTTPS.");
  }
  return parsedUrl.href;
}

function renderEverything() {
  renderProductList();
  renderProductEditor();
  renderCategories();
  renderSettings();
}

async function persistCatalog(successMessage) {
  try {
    catalog = await saveCatalog(catalog);
    renderEverything();
    setStatus(successMessage);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function renderSettings() {
  const settings = catalog.settings;
  document.querySelector("#setting-store-name").value = settings.storeName;
  document.querySelector("#setting-announcement").value = settings.announcement;
  document.querySelector("#setting-announcement-secondary").value =
    settings.announcementSecondary;
  document.querySelector("#setting-hero-eyebrow").value = settings.heroEyebrow;
  document.querySelector("#setting-title-line-1").value = settings.heroTitleLine1;
  document.querySelector("#setting-title-line-2").value = settings.heroTitleLine2;
  document.querySelector("#setting-hero-description").value =
    settings.heroDescription;
  document.querySelector("#setting-hero-image").value = settings.heroImage;
  document.querySelector("#setting-promo-code").value = settings.promoCode;
  document.querySelector("#setting-promo-percent").value = settings.promoPercent;
}

document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((item) => {
      item.classList.toggle("is-active", item === tab);
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      const active = panel.id === `panel-${tab.dataset.tab}`;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  });
});

document.querySelector("#new-product").addEventListener("click", () => {
  if (!catalog.categories.length) {
    setStatus("Crie uma categoria antes de cadastrar produtos.", true);
    document.querySelector('[data-tab="categories"]').click();
    return;
  }
  let id = `produto-${Date.now().toString(36)}`;
  while (catalog.products.some((product) => product.id === id)) {
    id = `produto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const firstVariant = catalog.products[0]?.variants[0];
  catalog.products.push({
    id,
    name: "Novo produto",
    description: "",
    priceCents: 0,
    promotionalPriceCents: null,
    categoryId: catalog.categories[0].id,
    checkoutUrl: "",
    supplierUrl: "",
    sizeChart: null,
    variants: [
      {
        id: "rosa",
        label: "Rosa",
        color: "#f20b83",
        images: firstVariant ? [...firstVariant.images] : ["/assets/catalog/rehva-store-cover.jpg", "/assets/catalog/rehva-store-cover.jpg"],
      },
    ],
  });
  selectProduct(id);
  document.querySelector("#product-name").focus();
});

document
  .querySelector("#product-has-sizes")
  .addEventListener("change", (event) => {
    const product = getSelectedProduct();
    if (!product) return;
    product.sizeChart = event.target.checked ? createDefaultSizeChart() : null;
    document.querySelector("#size-chart-editor").hidden = !event.target.checked;
    if (event.target.checked) renderSizeChart(product);
  });

document.querySelector("#add-size-row").addEventListener("click", () => {
  const product = getSelectedProduct();
  if (!product?.sizeChart) return;
  if (product.sizeChart.length >= 30) {
    setStatus("Cada produto pode ter até 30 tamanhos.", true);
    return;
  }
  product.sizeChart.push({
    size: "",
    bust: null,
    length: null,
    shoulders: null,
  });
  renderSizeChart(product);
});

document.querySelector("#add-variant").addEventListener("click", () => {
  const product = getSelectedProduct();
  if (!product) return;
  const usedIds = new Set(product.variants.map((variant) => variant.id));
  let suffix = product.variants.length + 1;
  let id = `opcao-${suffix}`;
  while (usedIds.has(id)) id = `opcao-${++suffix}`;
  const exampleImages = product.variants[0]?.images ?? [
    "/assets/catalog/rehva-store-cover.jpg",
    "/assets/catalog/rehva-store-cover.jpg",
  ];
  product.variants.push({
    id,
    label: `Opção ${suffix}`,
    color: "#f20b83",
    images: [...exampleImages],
  });
  renderVariants(product);
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const product = getSelectedProduct();
  if (!product) return;
  try {
    const name = document.querySelector("#product-name").value.trim();
    const categoryId = document.querySelector("#product-category").value;
    if (!catalog.categories.some((category) => category.id === categoryId)) {
      throw new Error("Selecione uma categoria válida.");
    }
    const checkoutInput = document.querySelector("#product-checkout").value;
    const supplierUrl = document
      .querySelector("#product-supplier-url")
      .value.trim();
    if (supplierUrl) {
      let parsedSupplierUrl;
      try {
        parsedSupplierUrl = new URL(supplierUrl);
      } catch {
        throw new Error("Informe um link HTTP ou HTTPS válido para o fornecedor.");
      }
      if (!["http:", "https:"].includes(parsedSupplierUrl.protocol)) {
        throw new Error("O link do fornecedor precisa usar HTTP ou HTTPS.");
      }
    }
    const variants = product.variants.map((variant) => ({
      ...variant,
      id: slugify(variant.label),
      label: variant.label.trim(),
      images: variant.images.map((image) => image.trim()),
    }));
    if (variants.some((variant) => !variant.id)) {
      throw new Error("Cada cor ou opção precisa ter um nome válido.");
    }
    product.name = name;
    product.priceCents = readPriceCents(
      document.querySelector("#product-price").value,
    );
    const promotionalPriceInput = document
      .querySelector("#product-promotional-price")
      .value.trim();
    product.promotionalPriceCents = promotionalPriceInput
      ? readPriceCents(promotionalPriceInput)
      : null;
    if (
      product.promotionalPriceCents !== null &&
      (product.promotionalPriceCents <= 0 ||
        product.promotionalPriceCents >= product.priceCents)
    ) {
      throw new Error(
        "O preço promocional precisa ser maior que zero e menor que o preço de venda.",
      );
    }
    product.description = document
      .querySelector("#product-description")
      .value.trim();
    product.categoryId = categoryId;
    product.checkoutUrl = extractCheckoutUrl(checkoutInput);
    product.supplierUrl = supplierUrl;
    product.sizeChart = document.querySelector("#product-has-sizes").checked
      ? product.sizeChart
      : null;
    product.variants = variants;
    await persistCatalog(`${name} salvo com sucesso.`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector("#delete-product").addEventListener("click", async () => {
  const product = getSelectedProduct();
  if (!product) return;
  if (!window.confirm(`Remover "${product.name}" da loja?`)) return;
  catalog.products = catalog.products.filter((entry) => entry.id !== product.id);
  selectedProductId = catalog.products[0]?.id ?? null;
  await persistCatalog("Produto removido da loja.");
});

document.querySelector("#category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nameInput = document.querySelector("#category-name");
  const name = nameInput.value.trim();
  const baseId = slugify(name);
  if (!baseId) {
    setStatus("Informe um nome válido para a categoria.", true);
    return;
  }
  let id = baseId;
  let suffix = 2;
  while (catalog.categories.some((category) => category.id === id)) {
    id = `${baseId}-${suffix++}`;
  }
  catalog.categories.push({ id, name });
  nameInput.value = "";
  await persistCatalog("Categoria criada.");
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const settings = catalog.settings;
  settings.storeName = document.querySelector("#setting-store-name").value.trim();
  settings.announcement = document.querySelector("#setting-announcement").value.trim();
  settings.announcementSecondary = document
    .querySelector("#setting-announcement-secondary")
    .value.trim();
  settings.heroEyebrow = document.querySelector("#setting-hero-eyebrow").value.trim();
  settings.heroTitleLine1 = document.querySelector("#setting-title-line-1").value.trim();
  settings.heroTitleLine2 = document.querySelector("#setting-title-line-2").value.trim();
  settings.heroDescription = document
    .querySelector("#setting-hero-description")
    .value.trim();
  settings.heroImage = document.querySelector("#setting-hero-image").value.trim();
  settings.promoCode = document.querySelector("#setting-promo-code").value.trim();
  settings.promoPercent = Number(
    document.querySelector("#setting-promo-percent").value,
  );
  await persistCatalog("Conteúdo da loja salvo.");
});

async function initialize() {
  try {
    catalog = await getCatalog();
    selectedProductId = catalog.products[0]?.id ?? null;
    renderEverything();
  } catch (error) {
    setStatus(error.message, true);
  }
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  const email = document.querySelector("#admin-auth-email").value.trim();
  const password = document.querySelector("#admin-auth-password").value;
  try {
    await login(email, password);
  } catch (error) {
    authError.textContent = "E-mail ou senha inválidos.";
  }
});

logoutButton.addEventListener("click", () => {
  void logout();
});

watchAuth((user) => {
  const authenticated = Boolean(user);
  authScreen.hidden = authenticated;
  adminApp.hidden = !authenticated;
  if (authenticated) {
    void initialize();
  }
});