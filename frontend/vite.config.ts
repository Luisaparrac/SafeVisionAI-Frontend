import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@safevision/local-dev-access": fileURLToPath(new URL(
        command === "serve" ? "./src/localDevAccess.ts" : "./src/localAccessDisabled.ts",
        import.meta.url,
      )),
    },
  },
}));
