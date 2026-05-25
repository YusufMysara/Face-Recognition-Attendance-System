import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Serve /ort-wasm/*.mjs as plain JS without Vite's module transform.
    //
    // Why this is necessary:
    //   - ORT Web dynamically imports .mjs worker scripts at runtime.
    //   - If the .mjs files live in /public, Vite blocks module imports from
    //     that folder ("should not be imported from source code").
    //   - Solution: keep .mjs files OUT of /public; intercept the requests
    //     here and pipe them straight from node_modules so Vite never sees
    //     them as "public" assets.
    {
      name: "ort-wasm-mjs",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Strip query-string (Vite appends ?v=... timestamps in dev mode)
          const cleanUrl = (req.url ?? "").split("?")[0];
          if (cleanUrl.startsWith("/ort-wasm/") && cleanUrl.endsWith(".mjs")) {
            const filename = path.basename(cleanUrl);
            const filePath = path.join(
              __dirname,
              "node_modules",
              "onnxruntime-web",
              "dist",
              filename
            );
            if (fs.existsSync(filePath)) {
              res.setHeader("Content-Type", "application/javascript");
              res.setHeader("Cache-Control", "public, max-age=86400");
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tell Vite not to pre-bundle onnxruntime-web — it manages its own WASM
  // loading and doesn't need Vite's dependency optimiser touching it.
  optimizeDeps: {
    exclude: ["onnxruntime-web"],
  },
}));
