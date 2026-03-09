import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        manifest: {
          name: 'bKash Pay',
          short_name: 'bKashPay',
          description: 'Secure Payment Gateway for bKash',
          theme_color: '#e2136e',
          icons: [
            {
              src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSJ2tQ2k31bVQkbTPpGnt_OGsln5ESawn8rGg&s',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.BKASH_BASE_URL': JSON.stringify(env.BKASH_BASE_URL),
      'process.env.APP_URL': JSON.stringify(env.APP_URL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
    },
  };
});
