import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { handleAdminApi, serveUploadedFile } from "./admin-store";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const production = process.argv.includes("--production");
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".jfif": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let vite;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function serveProductionFile(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }

  const distDirectory = path.join(root, "dist");
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(distDirectory, relativePath);

  if (!filePath.startsWith(`${distDirectory}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }

  const contentType = mimeTypes[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    response.writeHead(404).end();
    return;
  }

  response.setHeader("Content-Type", contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      response.writeHead(404).end();
      return;
    }
    console.error("Falha ao servir arquivo da loja:", error.message);
    response.writeHead(500).end();
  });

  if (request.method === "HEAD") {
    response.writeHead(200).end();
    stream.destroy();
    return;
  }
  stream.pipe(response);
}

async function serveLocalStoreImage(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end();
    return true;
  }
  if (decodedPath.includes("\\") || decodedPath.includes("\0")) {
    response.writeHead(400).end();
    return true;
  }

  const allowedDirectory =
    decodedPath.startsWith("/loja/") ? "loja" :
      decodedPath.startsWith("/photo/") ? "photo" : null;
  if (!allowedDirectory) return false;

  const filePath = path.resolve(root, decodedPath.slice(1));
  const allowedRoot = path.join(root, allowedDirectory);
  if (!filePath.startsWith(`${allowedRoot}${path.sep}`)) {
    response.writeHead(403).end();
    return true;
  }
  const contentType = mimeTypes[path.extname(filePath).toLowerCase()];
  if (!contentType?.startsWith("image/")) {
    response.writeHead(404).end();
    return true;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      response.writeHead(404).end();
      return;
    }
    console.error("Falha ao servir imagem do catálogo:", error.message);
    response.writeHead(500).end();
  });
  response.setHeader("Cache-Control", "public, max-age=3600");
  response.setHeader("Content-Type", contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (request.method === "HEAD") {
    response.writeHead(200).end();
    stream.destroy();
    return true;
  }
  stream.pipe(response);
  return true;
}

const httpServer = createHttpServer((request, response) => {
  void (async () => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;

    if (pathname === "/uploads" || pathname.startsWith("/uploads/")) {
      if (await serveUploadedFile(request, response, pathname)) return;
    }

    if (pathname.startsWith("/api/")) {
      if (production && request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 403, { error: "A edição do catálogo está disponível somente no modo de desenvolvimento local." });
        return;
      }
      if (await handleAdminApi(request, response, pathname, { readOnly: production })) return;
      sendJson(response, 404, { error: "Rota não encontrada." });
      return;
    }

    if (production) {
      if (await serveLocalStoreImage(request, response, pathname)) return;
      await serveProductionFile(request, response, pathname);
      return;
    }

    vite.middlewares(request, response);
  })().catch((error) => {
    console.error("Falha ao processar solicitação da loja:", error.message);
    if (!response.headersSent) {
      sendJson(
        response,
        error.statusCode || 500,
        {
          error:
            error.statusCode && error.statusCode < 500
              ? error.message
              : "Não foi possível processar a solicitação. Tente novamente.",
        },
      );
    } else {
      response.destroy(error);
    }
  });
});

if (!production) {
  vite = await createViteServer({
    appType: "spa",
    root,
    server: {
      hmr: { server: httpServer },
      middlewareMode: true,
    },
  });
}

httpServer.listen(port, production ? "0.0.0.0" : "127.0.0.1", () => {
  console.log(
    `REHVA ${production ? "produção" : "desenvolvimento"} em http://localhost:${port}`,
  );
});
