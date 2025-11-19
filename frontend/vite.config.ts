import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-tabs', '@radix-ui/react-select'],
          'chart-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
          // Split large components
          'ai-components': [
            './src/components/AIAnalytics.tsx',
            './src/components/AIAnalysisWorkflow.tsx'
          ],
          'analytics-components': [
            './src/components/ListBasedAnalytics.tsx',
            './src/lib/analyticsService.ts'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Increase limit to 1MB
    target: 'esnext',
    minify: 'esbuild', // Use esbuild instead of terser
  },
}));
