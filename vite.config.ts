import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import compression from "vite-plugin-compression";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // ✅ GZIP compression for all assets
    compression({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 10240, // Only compress files larger than 10KB
      deleteOriginFile: false,
    }),
    // ✅ Brotli compression (better compression, newer browsers)
    compression({
      algorithm: "brotli",
      ext: ".br",
      threshold: 10240,
      deleteOriginFile: false,
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon.ico", "robots.txt", "apple-touch-icon.png"],
      workbox: {
        // Allow precaching of larger JS bundles (default is 2 MiB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "AUSDAV",
        short_name: "AUSDAV",
        description: "AUSDAV is a non-profit organization dedicated to the holistic development of university students in Vavuniya, Sri Lanka.",
        theme_color: "#004aad",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/AUSDAV_llogo.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/AUSDAV_llogo.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime'
    ]
  },
  build: {
    // ✅ CODE SPLITTING: Split chunks to improve caching and parallel loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - separate dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-animation': ['framer-motion'],
          // Heavy libraries - lazy load on demand
          'lib-katex': ['katex', 'rehype-katex'],
          'lib-charts': ['recharts'],
          'lib-pdf': ['html2canvas', 'jspdf', 'jspdf-autotable'],
          'lib-markdown': ['react-markdown', 'remark-math'],
        }
      }
    },
    // ✅ Increase chunk size limits and suppress overflow warnings
    chunkSizeWarningLimit: 1000,
    // ✅ Enable source maps for production debugging (remove in final build if size is concern)
    sourcemap: false,
    // ✅ Minify with esbuild (faster than default terser)
    minify: 'esbuild',
    // ✅ Asset handling - inline small assets
    assetsInlineLimit: 4096, // 4KB threshold for inlining
  },
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
