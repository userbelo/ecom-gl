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
const categoryType = document.querySelector("#category-type");
const createBannerFields = document.querySelector("#category-create-banner-fields");
const createDesktopImage = document.querySelector("#category-desktop-image");
const createMobileImage = document.querySelector("#category-mobile-image");
const variantEditorList = document.querySelector("#variant-editor-list");
const authScreen = document.querySelector("#admin-auth");
const adminApp = document.querySelector("#admin-content");
const authForm = document.querySelector("#admin-auth-form");
const authError = document.querySelector("#admin-auth-error");
const logoutButton = document.querySelector("#admin-logout");
const toast = document.querySelector("#admin-toast");
const confirmModal = document.querySelector("#admin-confirm");
const confirmTitle = document.querySelector("#confirm-title");
const confirmMessage = document.querySelector("#confirm-message");
const confirmSubmit = document.querySelector("#confirm-submit");
const closeProductEditor = document.querySelector("#close-product-editor");
const editorStepButtons = document.querySelectorAll(".editor-step");
const editorStepPanels = document.querySelectorAll("[data-editor-panel]");
let catalog;
let selectedProductId = null;
let statusTimeout;
let toastTimeout;
let confirmResolve;
let persistQueue = Promise.resolve();

function getCategoryKind(category) {
  return category.kind || (category.desktopImage || category.mobileImage ? "banner" : "filter");
}

function getComboCategories() {
  return catalog.categories.filter((category) => getCategoryKind(category) === "combo");
}

function renderProductRecommendations(product) {
  const container = document.querySelector("#product-recommendations");
  if (!container) return;
  const categoryProducts = catalog.products.filter(
    (candidate) =>
      candidate.categoryId === product.categoryId && candidate.id !== product.id,
  );
  if (categoryProducts.length === 0) {
    container.replaceChildren(
      createElement(
        "small",
        "product-recommendations__empty",
        "Não há outros produtos nesta categoria para recomendar.",
      ),
    );
    return;
  }
  const selectedIds = new Set(product.recommendedProductIds ?? []);
  container.replaceChildren(
    ...categoryProducts.map((candidate) => {
      const label = createElement("label", "product-recommendation-option");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = candidate.id;
      checkbox.checked = selectedIds.has(candidate.id);
      checkbox.addEventListener("change", () => {
        product.recommendedProductIds = Array.from(
          container.querySelectorAll("input:checked"),
        ).map((input) => input.value);
      });
      label.append(checkbox, createElement("span", "", candidate.name));
      return label;
    }),
  );
}

function setEditorStep(step) {
  editorStepButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.editorStep === step);
  });
  editorStepPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.editorPanel === step);
  });
}

editorStepButtons.forEach((button) => {
  button.addEventListener("click", () => setEditorStep(button.dataset.editorStep));
});
document.querySelectorAll("[data-step-next]").forEach((button) => {
  button.addEventListener("click", () => setEditorStep(button.dataset.stepNext));
});

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
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.hidden = true;
  }, isError ? 7000 : 3500);
  window.clearTimeout(statusTimeout);
  statusTimeout = window.setTimeout(() => {
    adminStatus.textContent = "";
    adminStatus.classList.remove("is-error");
  }, 5000);
}

function askConfirmation(title, message, actionLabel = "Confirmar") {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmSubmit.textContent = actionLabel;
  confirmModal.hidden = false;
  confirmSubmit.focus();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function closeConfirmation(result) {
  confirmModal.hidden = true;
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

confirmModal.querySelectorAll("[data-confirm-cancel]").forEach((button) => {
  button.addEventListener("click", () => closeConfirmation(false));
});
confirmSubmit.addEventListener("click", () => closeConfirmation(true));

function setButtonBusy(button, busy, busyLabel = "Salvando...") {
  if (!button) return;
  if (busy) {
    button.dataset.defaultLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.defaultLabel || button.textContent;
    delete button.dataset.defaultLabel;
    button.disabled = false;
  }
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
  productForm.classList.toggle("is-open", Boolean(product));
  productEmpty.hidden = Boolean(product);
  productFields.hidden = !product;
  if (!product) return;
  setEditorStep("1");

  document.querySelector("#product-editor-title").textContent = product.name;
  document.querySelector("#product-id").value = product.id;
  document.querySelector("#product-name").value = product.name;
  document.querySelector("#product-price").value = (product.priceCents / 100)
    .toFixed(2)
    .replace(".", ",");
  document.querySelector("#product-promotional-price").value =
    product.promotionalPriceCents == null
      ? ""
      : (product.promotionalPriceCents / 100).toFixed(2).replace(".", ",");
  document.querySelector("#product-review-rating").value =
    product.reviewRating ?? 4.5;
  document.querySelector("#product-review-count").value =
    product.reviewCount ?? 0;
  document.querySelector("#product-description").value =
    product.description || "";
  document.querySelector("#product-visibility").value =
    product.catalogOnly ? "category" : "store";
  const comboSelect = document.querySelector("#product-combo-category");
  comboSelect.replaceChildren(
    createElement("option", "", "Não participar"),
    ...getComboCategories().map((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      option.selected = category.id === product.comboCategoryId;
      return option;
    }),
  );
  comboSelect.value = product.comboCategoryId ?? "";
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
  renderProductRecommendations(product);
  categorySelect.onchange = () => {
    product.categoryId = categorySelect.value;
    product.recommendedProductIds = [];
    renderProductRecommendations(product);
  };
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

closeProductEditor.addEventListener("click", () => {
  selectedProductId = null;
  renderProductList();
  renderProductEditor();
});

function renderCategories() {
  categoryList.replaceChildren();
  const categoryGroups = [
    {
      kind: "filter",
      title: "Filtros da vitrine",
      description: 'Categorias que aparecem ao lado do filtro “Todos”.',
    },
    {
      kind: "banner",
      title: "Banners em carrossel",
      description: "Banners exibidos acima dos produtos. Use as setas para mudar a ordem.",
    },
    {
      kind: "combo",
      title: "Kits e combos",
      description: "Categorias usadas no carrossel especial de kits e combos.",
    },
  ];
  categoryGroups.forEach((group) => {
    const groupCategories = catalog.categories.filter(
      (category) => getCategoryKind(category) === group.kind,
    );
    const section = createElement("section", `category-group category-group--${group.kind}`);
    const groupHeader = createElement("header", "category-group__header");
    const groupTitle = createElement("div", "category-group__title");
    groupTitle.append(
      createElement("h3", "", group.title),
      createElement("p", "", group.description),
    );
    groupHeader.append(
      groupTitle,
      createElement(
        "span",
        "category-group__count",
        `${groupCategories.length} ${groupCategories.length === 1 ? "categoria" : "categorias"}`,
      ),
    );
    const groupList = createElement("div", "category-group__items");
    if (!groupCategories.length) {
      groupList.append(
        createElement(
          "p",
          "category-group__empty",
          "Nenhuma categoria deste tipo cadastrada.",
        ),
      );
    }
    groupCategories.forEach((category) => {
    const row = createElement("div", "category-row");
    const heading = createElement("div", "category-row__heading");
    const name = createElement("strong", "", category.name);
    const usageCount = catalog.products.filter(
      (product) => product.categoryId === category.id,
    ).length;
    const comboUsageCount = catalog.products.filter(
      (product) => product.comboCategoryId === category.id,
    ).length;
    const usage = createElement(
      "small",
      "",
      `${usageCount} ${usageCount === 1 ? "produto" : "produtos"}${
        comboUsageCount
          ? ` · ${comboUsageCount} no carrossel`
          : ""
      }`,
    );
    heading.append(name, usage);
    const actions = createElement("div", "category-row__actions");
    if (getCategoryKind(category) === "banner") {
      const banners = catalog.categories.filter(
        (entry) => getCategoryKind(entry) === "banner",
      );
      const bannerPosition = banners.findIndex((entry) => entry.id === category.id);
      const bannerOrder = createElement("div", "category-row__order");
      const moveUp = createElement("button", "category-row__move", "↑");
      moveUp.type = "button";
      moveUp.disabled = bannerPosition === 0;
      moveUp.setAttribute("aria-label", `Mover banner ${category.name} para cima`);
      moveUp.addEventListener("click", async () => {
        await moveBannerCategory(category.id, -1);
      });
      const moveDown = createElement("button", "category-row__move", "↓");
      moveDown.type = "button";
      moveDown.disabled = bannerPosition === banners.length - 1;
      moveDown.setAttribute("aria-label", `Mover banner ${category.name} para baixo`);
      moveDown.addEventListener("click", async () => {
        await moveBannerCategory(category.id, 1);
      });
      bannerOrder.append(moveUp, moveDown);
      actions.append(bannerOrder);
    }
    const rename = document.createElement("input");
    rename.value = category.name;
    rename.maxLength = 80;
    rename.setAttribute("aria-label", `Nome da categoria ${category.name}`);
    const desktopImageField = createElement("label", "category-image-field");
    desktopImageField.append(
      createElement("strong", "", "BANNER DESKTOP"),
      createElement("small", "", "1360 × 314 px · exibição 680 × 157 px · proporção 13:3"),
    );
    const desktopImage = document.createElement("input");
    desktopImage.type = "url";
    desktopImage.maxLength = 2048;
    desktopImage.value = category.desktopImage ?? catalog.settings.heroImage;
    desktopImage.placeholder = "Cole aqui a URL da imagem desktop";
    desktopImage.setAttribute("aria-label", `Imagem desktop de ${category.name}`);
    desktopImageField.append(desktopImage);
    const mobileImage = document.createElement("input");
    const mobileImageField = createElement("label", "category-image-field");
    mobileImageField.append(
      createElement("strong", "", "BANNER MOBILE"),
      createElement("small", "", "750 × 380 px · proporção 15:7,6 · horizontal compacto"),
    );
    mobileImage.type = "url";
    mobileImage.maxLength = 2048;
    mobileImage.value =
      category.mobileImage ?? category.desktopImage ?? catalog.settings.heroImage;
    mobileImage.placeholder = "Cole aqui a URL da imagem mobile";
    mobileImage.setAttribute("aria-label", `Imagem mobile de ${category.name}`);
    mobileImageField.append(mobileImage);
    const fields = createElement("div", "category-row__fields");
    fields.append(desktopImageField, mobileImageField);
    const typeSelect = document.createElement("select");
    typeSelect.setAttribute("aria-label", `Tipo da categoria ${category.name}`);
    typeSelect.innerHTML =
      '<option value="filter">Filtro ao lado de "Todos"</option><option value="banner">Banner em carrossel</option><option value="combo">Kits/combos em carrossel</option>';
    typeSelect.value = getCategoryKind(category);
    typeSelect.className = "category-row__type";
    fields.prepend(typeSelect);
    const syncTypeFields = () => {
      const needsImages = ["banner", "combo"].includes(typeSelect.value);
      desktopImageField.hidden = !needsImages;
      mobileImageField.hidden = !needsImages;
    };
    typeSelect.addEventListener("change", syncTypeFields);
    syncTypeFields();
    const transferTarget = document.createElement("select");
    transferTarget.className = "category-row__transfer";
    transferTarget.setAttribute(
      "aria-label",
      `Categoria de destino dos produtos de ${category.name}`,
    );
    transferTarget.append(
      createElement("option", "", "Transferir produtos para..."),
    );
    catalog.categories
      .filter((entry) => entry.id !== category.id)
      .forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = entry.name;
        transferTarget.append(option);
      });
    const saveName = createElement("button", "", "SALVAR CATEGORIA");
    saveName.type = "button";
    saveName.addEventListener("click", async () => {
      const nextName = rename.value.trim();
      if (!nextName) {
        setStatus("Informe um nome para a categoria.", true);
        return;
      }
      const needsImages = ["banner", "combo"].includes(typeSelect.value);
      if (needsImages && (!desktopImage.value.trim() || !mobileImage.value.trim())) {
        setStatus("Informe as imagens desktop e mobile da categoria.", true);
        return;
      }
      category.name = nextName;
      category.kind = typeSelect.value;
      if (needsImages) {
        category.desktopImage = desktopImage.value.trim();
        category.mobileImage = mobileImage.value.trim();
      } else {
        delete category.desktopImage;
        delete category.mobileImage;
      }
      await persistCatalog("Nome da categoria atualizado.");
    });
    const remove = createElement("button", "", "EXCLUIR");
    remove.type = "button";
    const totalUsageCount = usageCount + comboUsageCount;
    remove.disabled = totalUsageCount > 0 && transferTarget.options.length < 2;
    remove.title = totalUsageCount
      ? "Escolha uma categoria de destino para transferir os produtos antes de excluir."
      : "Excluir categoria";
    remove.addEventListener("click", async () => {
      const targetId = transferTarget.value;
      if (usageCount > 0 && !targetId) {
        setStatus("Escolha a categoria que receberá os produtos antes de excluir.", true);
        transferTarget.focus();
        return;
      }
      const confirmed = await askConfirmation(
        "Excluir categoria?",
        totalUsageCount > 0
          ? `A categoria "${category.name}" será removida e seus vínculos serão transferidos ou removidos.`
          : `A categoria "${category.name}" será removida. Os produtos não serão excluídos.`,
        "Excluir categoria",
      );
      if (!confirmed) return;
      if (usageCount > 0) {
        catalog.products.forEach((product) => {
          if (product.categoryId === category.id) product.categoryId = targetId;
        });
      }
      if (comboUsageCount > 0) {
        catalog.products.forEach((product) => {
          if (product.comboCategoryId === category.id) delete product.comboCategoryId;
        });
      }
      catalog.categories = catalog.categories.filter(
        (entry) => entry.id !== category.id,
      );
      await persistCatalog("Categoria removida.");
    });
    if (usageCount > 0) actions.append(transferTarget);
    actions.append(saveName, remove);
    row.append(heading, rename, fields, actions);
    groupList.append(row);
    });
    section.append(groupHeader, groupList);
    categoryList.append(section);
  });
}

async function moveBannerCategory(categoryId, direction) {
  const bannerIndexes = catalog.categories
    .map((category, index) =>
      getCategoryKind(category) === "banner" ? index : -1,
    )
    .filter((index) => index >= 0);
  const currentPosition = bannerIndexes.findIndex(
    (index) => catalog.categories[index].id === categoryId,
  );
  const targetPosition = currentPosition + direction;
  if (
    currentPosition < 0 ||
    targetPosition < 0 ||
    targetPosition >= bannerIndexes.length
  ) {
    return;
  }
  const currentIndex = bannerIndexes[currentPosition];
  const targetIndex = bannerIndexes[targetPosition];
  [catalog.categories[currentIndex], catalog.categories[targetIndex]] = [
    catalog.categories[targetIndex],
    catalog.categories[currentIndex],
  ];
  await persistCatalog("Ordem dos banners atualizada.");
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

function validateImageUrl(value, productName, variantLabel, imageIndex) {
  if (!value) {
    throw new Error(
      `Informe a foto ${imageIndex + 1} da opção "${variantLabel}" de "${productName}".`,
    );
  }
  if (/^https:\/\//i.test(value)) return;
  const match = value.match(/^\/(assets\/catalog|uploads)\/(.+)$/);
  if (
    !match ||
    match[2]
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(
      `A foto ${imageIndex + 1} da opção "${variantLabel}" precisa ser um link HTTPS ou uma imagem local válida.`,
    );
  }
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

async function persistCatalog(successMessage, submitButton = null) {
  setButtonBusy(submitButton, true);
  setStatus("Salvando alterações...");
  const saveOperation = persistQueue.then(async () => {
    try {
      catalog = await saveCatalog(catalog);
      renderEverything();
      setStatus(successMessage);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar. Tente novamente.",
        true,
      );
    } finally {
      setButtonBusy(submitButton, false);
    }
  });
  persistQueue = saveOperation.catch(() => undefined);
  await saveOperation;
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
  document.querySelector("#setting-entry-screen-enabled").checked =
    settings.entryScreenEnabled !== false;
  document.querySelector("#setting-intro-animation-enabled").checked =
    settings.introAnimationEnabled !== false;
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
    catalogOnly: false,
    comboCategoryId: null,
    priceCents: 0,
    promotionalPriceCents: null,
    reviewRating: 4.5,
    reviewCount: 0,
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
  const submitButton = event.submitter;
  const product = getSelectedProduct();
  if (!product) return;
  try {
    const name = document.querySelector("#product-name").value.trim();
    if (!name) {
      throw new Error("Informe o nome do produto.");
    }
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
    variants.forEach((variant) => {
      if (!variant.id) {
        throw new Error("Cada cor ou opção precisa ter um nome válido.");
      }
      variant.images.forEach((image, imageIndex) => {
        validateImageUrl(image, name, variant.label, imageIndex);
      });
    });
    if (new Set(variants.map((variant) => variant.id)).size !== variants.length) {
      throw new Error("As cores ou opções precisam ter nomes diferentes.");
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
    const reviewRating = Number(
      document.querySelector("#product-review-rating").value,
    );
    const reviewCount = Number(
      document.querySelector("#product-review-count").value,
    );
    if (
      !Number.isFinite(reviewRating) ||
      reviewRating < 0.5 ||
      reviewRating > 4.5 ||
      Math.round(reviewRating * 2) !== reviewRating * 2
    ) {
      throw new Error("A nota precisa estar entre 0,5 e 4,5 em passos de 0,5.");
    }
    if (!Number.isSafeInteger(reviewCount) || reviewCount < 0) {
      throw new Error("A quantidade de avaliações precisa ser um número inteiro.");
    }
    product.reviewRating = reviewRating;
    product.reviewCount = reviewCount;
    product.description = document
      .querySelector("#product-description")
      .value.trim();
    if (!product.description) {
      throw new Error("Informe uma descrição para o produto.");
    }
    product.catalogOnly =
      document.querySelector("#product-visibility").value === "category";
    product.comboCategoryId =
      document.querySelector("#product-combo-category").value || null;
    product.categoryId = categoryId;
    product.recommendedProductIds = Array.from(
      new Set(
        (product.recommendedProductIds ?? []).filter((id) =>
          catalog.products.some(
            (candidate) =>
              candidate.id === id &&
              candidate.id !== product.id &&
              candidate.categoryId === categoryId,
          ),
        ),
      ),
    );
    product.checkoutUrl = extractCheckoutUrl(checkoutInput);
    product.supplierUrl = supplierUrl;
    product.sizeChart = document.querySelector("#product-has-sizes").checked
      ? product.sizeChart
      : null;
    product.variants = variants;
    await persistCatalog(`${name} salvo com sucesso.`, submitButton);
  } catch (error) {
    setButtonBusy(submitButton, false);
    setStatus(error.message, true);
  }
});

document.querySelector("#delete-product").addEventListener("click", async () => {
  const product = getSelectedProduct();
  if (!product) return;
  const confirmed = await askConfirmation(
    "Remover produto?",
    `"${product.name}" será removido da vitrine. Esta ação não pode ser desfeita.`,
    "Remover produto",
  );
  if (!confirmed) return;
  catalog.products = catalog.products.filter((entry) => entry.id !== product.id);
  selectedProductId = catalog.products[0]?.id ?? null;
  await persistCatalog("Produto removido da loja.");
});

document.querySelector("#category-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const nameInput = document.querySelector("#category-name");
  const name = nameInput.value.trim();
  const kind = categoryType.value;
  const baseId = slugify(name);
  if (!baseId) {
    setStatus("Informe um nome válido para a categoria.", true);
    return;
  }
  if (
    catalog.categories.some(
      (category) =>
        category.name.trim().toLocaleLowerCase("pt-BR") ===
        name.toLocaleLowerCase("pt-BR"),
    )
  ) {
    setStatus("Já existe uma categoria com esse nome.", true);
    return;
  }
  let id = baseId;
  let suffix = 2;
  while (catalog.categories.some((category) => category.id === id)) {
    id = `${baseId}-${suffix++}`;
  }
  const category = { id, name, kind };
  if (["banner", "combo"].includes(kind)) {
    const desktopImage = createDesktopImage.value.trim();
    const mobileImage = createMobileImage.value.trim();
    if (!desktopImage || !mobileImage) {
      setStatus("Para criar um banner, informe as imagens desktop e mobile.", true);
      return;
    }
    category.desktopImage = desktopImage;
    category.mobileImage = mobileImage;
  }
  catalog.categories.push(category);
  nameInput.value = "";
  createDesktopImage.value = "";
  createMobileImage.value = "";
  await persistCatalog("Categoria criada.", submitButton);
});

categoryType.addEventListener("change", () => {
  createBannerFields.hidden = !["banner", "combo"].includes(categoryType.value);
});

document.querySelector("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
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
  settings.entryScreenEnabled = document.querySelector(
    "#setting-entry-screen-enabled",
  ).checked;
  settings.introAnimationEnabled = document.querySelector(
    "#setting-intro-animation-enabled",
  ).checked;
  settings.promoCode = document.querySelector("#setting-promo-code").value.trim();
  settings.promoPercent = Number(
    document.querySelector("#setting-promo-percent").value,
  );
  await persistCatalog("Conteúdo da loja salvo.", submitButton);
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
  const submitButton = event.submitter;
  authError.textContent = "";
  const email = document.querySelector("#admin-auth-email").value.trim();
  const password = document.querySelector("#admin-auth-password").value;
  try {
    setButtonBusy(submitButton, true, "Entrando...");
    await login(email, password);
  } catch (error) {
    authError.textContent = "E-mail ou senha inválidos.";
  } finally {
    setButtonBusy(submitButton, false);
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