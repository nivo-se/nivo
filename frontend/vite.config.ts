import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Loads .env, .env.local, .env.[mode], .env.[mode].local from frontend/ (not from shell-only vars).
  const env = loadEnv(mode, __dirname, "");
  const apiProxyTarget =
    (env.VITE_DEV_API_PROXY_TARGET || "").trim() || "http://127.0.0.1:8000";
  const crmProxyTarget =
    (env.VITE_CRM_SERVER_URL || "").trim() || "http://127.0.0.1:3001";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Dev: browser uses same-origin /api and /health; Vite forwards to FastAPI (local or LAN Mac mini).
        // Per machine: set VITE_DEV_API_PROXY_TARGET in frontend/.env.local (gitignored).
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/health": {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/crm": {
          target: crmProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/track": {
          target: crmProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      react(),
      // componentTagger disabled in dev to avoid blank-page issues; re-enable if needed
      // mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Ensure Auth0 resolves when deps are hoisted to root (workspace)
        "@auth0/auth0-react": path.resolve(__dirname, "../node_modules/@auth0/auth0-react"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor libraries
            "react-vendor": ["react", "react-dom"],
            "ui-vendor": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-tabs",
              "@radix-ui/react-select",
            ],
            "chart-vendor": ["recharts"],
            // Split large components
            "ai-components": [
              "./src/components/AIAnalytics.tsx",
              "./src/components/AIAnalysisWorkflow.tsx",
            ],
            "analytics-components": [
              "./src/components/ListBasedAnalytics.tsx",
              "./src/lib/analyticsService.ts",
            ],
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Increase limit to 1MB
      target: "esnext",
      minify: "esbuild", // Use esbuild instead of terser
    },
  };
});
