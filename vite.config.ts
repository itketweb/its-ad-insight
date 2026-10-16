import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'serve-local-data-and-config',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/data/latest.json')) {
            const filePath = path.resolve(__dirname, 'data/latest.json');
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          if (req.url?.startsWith('/js/config.js')) {
            const filePath = path.resolve(__dirname, 'js/config.js');
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/data/latest.json')) {
            const filePath = path.resolve(__dirname, 'data/latest.json');
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 2000,
    strictPort: true,
  },
  preview: {
    port: 2000,
    strictPort: true,
  },
});
