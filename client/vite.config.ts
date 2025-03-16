// 1. First, update vite.config.ts to include CORS and cache-control headers
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import vitePluginString from "vite-plugin-string";

export default defineConfig({
  plugins: [
    sveltekit(),
    vitePluginString(),
    {
      name: 'configure-response-headers',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET');
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          next();
        });
      }
    }
  ],
  build: {
    target: "esnext",
  },
  server: {
	proxy: {
			'/_ws': {
				target: 'wss://discordsays.com',
				ws: true,
				changeOrigin: true
			},
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin', 
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  }
});