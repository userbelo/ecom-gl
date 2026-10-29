import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        store: path.resolve(root, "index.html"),
        admin: path.resolve(root, "admin.html"),
      },
    },
  },
});
