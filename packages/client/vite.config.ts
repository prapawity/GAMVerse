import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        id: "/",
        name: "GAMVerse",
        short_name: "GAMVerse",
        description: "Meet and work together in your shared virtual office.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#120b1d",
        theme_color: "#120b1d",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        globPatterns: ["index.html", "assets/*.{js,css}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/(?:auth|offices|office-invites|maintainer|health|matchmake|media)(?:\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
      },
    }),
  ],
  resolve: { dedupe: ["three"] },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: [process.env.DEV_HOST ?? "localhost", "localhost"],
    watch: {
      // Docker Desktop on Windows does not always forward bind-mount file
      // notifications to Vite. Poll source files without scanning imported
      // 3D asset packs every 250ms; those large directories are static during
      // a dev session and make the server unresponsive when polled recursively.
      usePolling: true,
      interval: 1500,
      ignored: ["**/packages/client/assets/**"],
    },
  },
});
