import { existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * `npm run dev` serves the Vercel functions in api/ too (Eats → Map locating, Bills → Scan), so they work
 * locally without `vercel dev`. They read .env like on Vercel; variables already set in the shell win.
 */
function devApi(): Plugin {
  return {
    name: "dev-api",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), "");
      for (const [k, v] of Object.entries(env)) process.env[k] ??= v;

      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.match(/^\/api\/([a-z]+)(?:[?#]|$)/)?.[1];
        const file = name && fileURLToPath(new URL(`./api/${name}.ts`, import.meta.url));
        if (!file || !existsSync(file)) return next();
        try {
          const handler = (await server.ssrLoadModule(file))[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers))
            if (typeof v === "string") headers.set(k, v);
          const response: Response = await handler(
            new Request(`http://localhost${req.url}`, {
              method: req.method,
              headers,
              body: chunks.length ? Buffer.concat(chunks) : undefined,
            })
          );
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(`[api/${name}] ${err instanceof Error ? err.stack : err}`);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `api/${name} crashed — see the dev server log` }));
        }
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { chunkSizeWarningLimit: 800 },
  plugins: [
    devApi(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Tokyo 2027",
        short_name: "Tokyo 2027",
        description: "Our group trip: where to eat, where to go, and the day-by-day plan",
        theme_color: "#ffffff",
        background_color: "#fbfaf8",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            // Cover photos from Supabase Storage: show cached copies when offline.
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: "CacheFirst",
            options: {
              cacheName: "covers",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "fonts",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
