import {
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDirectory = path.join(root, "data");
const uploadsDirectory = path.join(dataDirectory, "uploads");
const catalogFile = path.join(dataDirectory, "catalog.json");
const seedFile = path.join(root, "public", "catalog.seed.json");
const maxJsonBytes = 2 * 1024 * 1024;
const maxImageBytes = 8 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", { extension: ".jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: ".png", matches: (bytes) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/gif", { extension: ".gif", matches: (bytes) => ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")) }],
  ["image/webp", { extension: ".webp", matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }],
]);

function httpError(statusCode, message) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function isLocalRequest(request) {
  const host = request.headers.host;
  const origin = request.headers.origin;
  if (!host) return false;
  try {
    const hostName = new URL(`http://${host}`).hostname;
    if (!["localhost", "127.0.0.1", "::1"].includes(hostName)) return false;
    if (origin && new URL(origin).host !== host) return false;
  } catch {
    return false;
  }

  const remoteAddress = request.socket.remoteAddress;
  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

function isAllowedImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (/^https:\/\//i.test(value)) return true;
  if (value.includes("\\") || value.includes("\0")) return false;
  const match = value.match(/^\/(assets\/catalog|uploads)\/(.+)$/);
  return Boolean(
    match &&
      match[2]
        .split("/")
        .every((segment) => segment && segment !== "." && segment !== ".."),
  );
}

function validateCatalog(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw httpError(400, "O catálogo enviado não tem um formato válido.");
  }
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) {
    throw httpError(400, "O catálogo precisa ter listas de categorias e produtos.");
  }
  if (catalog.categories.length > 100 || catalog.products.length > 500) {
    throw httpError(400, "O catálogo excede o limite de itens.");
  }

  const categoryIds = new Set();
  for (const category of catalog.categories) {
    if (
      !category ||
      typeof category.id !== "string" ||
      !/^[a-z0-9-]{1,60}$/.test(category.id) ||
      typeof category.name !== "string" ||
      !category.name.trim() ||
      category.name.length > 80 ||
      categoryIds.has(category.id)
    ) {
      throw httpError(400, "Há uma categoria inválida ou duplicada.");
    }
    categoryIds.add(category.id);
  }

  const productIds = new Set();
  for (const product of catalog.products) {
    if (
      !product ||
      typeof product.id !== "string" ||
      !/^[a-z0-9-]{1,80}$/.test(product.id) ||
      productIds.has(product.id) ||
      typeof product.name !== "string" ||
      !product.name.trim() ||
      product.name.length > 120 ||
      typeof product.description !== "string" ||
      product.description.length > 3000 ||
      !Number.isSafeInteger(product.priceCents) ||
      product.priceCents < 0 ||
      !(
        product.promotionalPriceCents === undefined ||
        product.promotionalPriceCents === null ||
        (Number.isSafeInteger(product.promotionalPriceCents) &&
          product.promotionalPriceCents > 0 &&
          product.promotionalPriceCents < product.priceCents)
      ) ||
      !categoryIds.has(product.categoryId) ||
      !Array.isArray(product.variants) ||
      product.variants.length < 1 ||
      product.variants.length > 30 ||
      typeof product.checkoutUrl !== "string" ||
      product.checkoutUrl.length > 2048 ||
      !(
        product.supplierUrl === undefined ||
        (typeof product.supplierUrl === "string" &&
          product.supplierUrl.length <= 2048)
      )
    ) {
      throw httpError(400, "Há um produto inválido ou sem uma categoria válida.");
    }
    productIds.add(product.id);

    if (product.sizeChart !== undefined && product.sizeChart !== null) {
      if (
        !Array.isArray(product.sizeChart) ||
        product.sizeChart.length < 1 ||
        product.sizeChart.length > 30
      ) {
        throw httpError(400, `A tabela de tamanhos de "${product.name}" é inválida.`);
      }
      const sizeLabels = new Set();
      for (const size of product.sizeChart) {
        const normalizedLabel =
          typeof size?.size === "string" ? size.size.trim().toLocaleUpperCase("pt-BR") : "";
        if (
          !size ||
          !normalizedLabel ||
          normalizedLabel.length > 20 ||
          sizeLabels.has(normalizedLabel) ||
          !["bust", "length", "shoulders"].every((measurement) => {
            const value = size[measurement];
            return (
              value === null ||
              (typeof value === "number" &&
                Number.isFinite(value) &&
                value >= 0 &&
                value <= 300)
            );
          })
        ) {
          throw httpError(400, `Há uma medida inválida na tabela de "${product.name}".`);
        }
        sizeLabels.add(normalizedLabel);
      }
    }

    if (product.checkoutUrl) {
      let checkoutUrl;
      try {
        checkoutUrl = new URL(product.checkoutUrl);
      } catch {
        throw httpError(400, `O link de checkout de "${product.name}" é inválido.`);
      }
      if (checkoutUrl.protocol !== "https:") {
        throw httpError(400, `O checkout de "${product.name}" precisa usar HTTPS.`);
      }
    }

    if (product.supplierUrl) {
      let supplierUrl;
      try {
        supplierUrl = new URL(product.supplierUrl);
      } catch {
        throw httpError(400, `O link do fornecedor de "${product.name}" é inválido.`);
      }
      if (!["http:", "https:"].includes(supplierUrl.protocol)) {
        throw httpError(
          400,
          `O link do fornecedor de "${product.name}" precisa usar HTTP ou HTTPS.`,
        );
      }
    }

    const variantIds = new Set();
    for (const variant of product.variants) {
      if (
        !variant ||
        typeof variant.id !== "string" ||
        !/^[a-z0-9-]{1,60}$/.test(variant.id) ||
        variantIds.has(variant.id) ||
        typeof variant.label !== "string" ||
        !variant.label.trim() ||
        variant.label.length > 80 ||
        typeof variant.color !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(variant.color) ||
        !Array.isArray(variant.images) ||
        variant.images.length < 1 ||
        variant.images.length > 20 ||
        !variant.images.every(isAllowedImageUrl)
      ) {
        throw httpError(400, `Há uma opção inválida em "${product.name}".`);
      }
      variantIds.add(variant.id);
    }
  }

  if (!catalog.settings || typeof catalog.settings !== "object") {
    throw httpError(400, "As configurações visuais da loja são obrigatórias.");
  }
  for (const key of [
    "storeName",
    "announcement",
    "announcementSecondary",
    "heroEyebrow",
    "heroTitleLine1",
    "heroTitleLine2",
    "heroDescription",
  ]) {
    if (
      typeof catalog.settings[key] !== "string" ||
      catalog.settings[key].length > 500
    ) {
      throw httpError(400, `A configuração "${key}" é inválida.`);
    }
  }
  if (
    typeof catalog.settings.promoCode !== "string" ||
    catalog.settings.promoCode.length > 40 ||
    !Number.isInteger(catalog.settings.promoPercent) ||
    catalog.settings.promoPercent < 0 ||
    catalog.settings.promoPercent > 100 ||
    !isAllowedImageUrl(catalog.settings.heroImage)
  ) {
    throw httpError(400, "As configurações de imagem ou promoção são inválidas.");
  }

  return catalog;
}

async function readCatalog() {
  await mkdir(dataDirectory, { recursive: true });
  try {
    const catalog = JSON.parse(await readFile(catalogFile, "utf8"));
    return validateCatalog(catalog);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const seed = validateCatalog(JSON.parse(await readFile(seedFile, "utf8")));
  await saveCatalog(seed);
  return seed;
}

async function readSeedCatalog() {
  return validateCatalog(JSON.parse(await readFile(seedFile, "utf8")));
}

async function saveCatalog(catalog) {
  const validated = validateCatalog(catalog);
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${catalogFile}.${process.pid}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(validated, null, 2)}\n`, {
    encoding: "utf8",
    flag: "w",
  });
  await rename(temporaryFile, catalogFile);
  return validated;
}

async function readRequestBody(request, maxBytes) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > maxBytes) {
    throw httpError(413, "O conteúdo enviado excede o tamanho permitido.");
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw httpError(413, "O conteúdo enviado excede o tamanho permitido.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function handleCatalogRequest(request, response, { readOnly = false } = {}) {
  if (request.method === "GET") {
    return sendJson(
      response,
      200,
      readOnly ? await readSeedCatalog() : await readCatalog(),
    );
  }
  if (request.method !== "PUT") {
    return sendJson(response, 405, { error: "Método não permitido." });
  }
  if (!isLocalRequest(request)) {
    return sendJson(response, 403, { error: "Edição disponível somente neste computador." });
  }
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    return sendJson(response, 415, { error: "Envie o catálogo em formato JSON." });
  }

  let catalog;
  try {
    catalog = JSON.parse((await readRequestBody(request, maxJsonBytes)).toString("utf8"));
  } catch (error) {
    if (error.statusCode) throw error;
    throw httpError(400, "O JSON do catálogo não pôde ser lido.");
  }
  return sendJson(response, 200, await saveCatalog(catalog));
}

async function handleImageUpload(request, response) {
  if (!isLocalRequest(request)) {
    return sendJson(response, 403, { error: "Envio de imagens disponível somente neste computador." });
  }
  if (request.method !== "POST") {
    return sendJson(response, 405, { error: "Método não permitido." });
  }
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  const imageType = allowedImageTypes.get(contentType);
  if (!imageType) {
    return sendJson(response, 415, { error: "Use uma imagem JPG, PNG, GIF ou WebP." });
  }

  const image = await readRequestBody(request, maxImageBytes);
  if (!image.length || !imageType.matches(image)) {
    return sendJson(response, 400, { error: "O arquivo enviado não corresponde ao formato da imagem." });
  }

  await mkdir(uploadsDirectory, { recursive: true });
  const filename = `${randomUUID()}${imageType.extension}`;
  await writeFile(path.join(uploadsDirectory, filename), image, { flag: "wx" });
  return sendJson(response, 201, { url: `/uploads/${filename}` });
}

function resolveUploadPath(pathname) {
  const filename = pathname.slice("/uploads/".length);
  if (!/^[0-9a-f-]{36}\.(jpg|png|gif|webp)$/.test(filename)) return null;
  return path.join(uploadsDirectory, filename);
}

export async function handleAdminApi(
  request,
  response,
  pathname,
  { readOnly = false } = {},
) {
  if (pathname === "/api/catalog") {
    await handleCatalogRequest(request, response, { readOnly });
    return true;
  }
  if (pathname === "/api/admin/upload") {
    await handleImageUpload(request, response);
    return true;
  }
  return false;
}

export async function serveUploadedFile(request, response, pathname) {
  const filePath = resolveUploadPath(pathname);
  if (!filePath) return false;
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return true;
  }

  try {
    const image = await readFile(filePath);
    const extension = path.extname(filePath);
    const contentType = [...allowedImageTypes.entries()].find(
      ([, type]) => type.extension === extension,
    )?.[0];
    if (!contentType) {
      response.writeHead(404).end();
      return true;
    }
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": image.length,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : image);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404).end();
      return true;
    }
    throw error;
  }
  return true;
}