// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  server: {
    host: true,
    port: 4321,
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  vite: {
    plugins: [
      {
        name: 'astro-force-full-reload',
        handleHotUpdate({ file, server }) {
          // Force immediate full page reload when any source file or asset changes
          if (file.includes('/src/') || file.includes('\\src\\') || file.includes('/public/') || file.includes('\\public\\')) {
            server.ws.send({
              type: 'full-reload',
              path: '*',
            });
          }
        },
      },
    ],
    server: {
      watch: {
        // Exclude huge folders from watcher so it never lags or chokes
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.astro/**'],
      },
    },
  },
});
