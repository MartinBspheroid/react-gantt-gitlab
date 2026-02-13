import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Check if we're building demos
  const isDemoBuild = process.env.BUILD_DEMOS === 'true';
  // Check if we're building full CSS
  const isFullCssBuild = process.env.BUILD_FULL_CSS === 'true';

  // Common resolve configuration for all builds
  const resolveConfig = {
    // Enable tsconfig paths resolution (Vite 8+ feature)
    tsconfigPaths: true,
    // Ensure TypeScript extensions are resolved
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  };

  if (isDemoBuild) {
    // Demo build configuration - includes all dependencies
    const base = process.env.VITE_BASE_PATH || '/';

    return {
      plugins: [react()],
      base: base,
      resolve: resolveConfig,
      build: {
        outDir: 'dist-demos',
        sourcemap: true,
        rollupOptions: {
          input: {
            main: resolve(__dirname, 'index.html'),
          },
        },
      },
    };
  }

  const rollupOptions = {
    output: {
      assetFileNames: 'index.css',
    },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ],
  };

  const rollupOptionsStrict = {
    ...rollupOptions,
    external: [...rollupOptions.external, /^@wx\//, /^@svar-ui\//],
  };

  if (isFullCssBuild) {
    // Full CSS build configuration
    return {
      plugins: [react()],
      resolve: resolveConfig,
      build: {
        outDir: 'dist-full',
        sourcemap: true,
        lib: {
          entry: resolve(__dirname, 'src/full-css.js'),
          fileName: 'index',
          formats: ['es'],
        },
        rollupOptions,
      },
    };
  }

  // Library build configuration (default) - Multiple entry points
  return {
    plugins: [react()],
    resolve: resolveConfig,
    server: {
      proxy: {
        '/api/data-proxy': {
          target: 'https://example.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/data-proxy/, ''),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              if (req.headers['x-auth-token']) {
                proxyReq.setHeader(
                  'Authorization',
                  `Bearer ${req.headers['x-auth-token']}`,
                );
              }
            });
          },
        },
      },
    },
    build: {
      sourcemap: true,
      lib: {
        entry: {
          index: resolve(__dirname, 'src/index.js'),
          kanban: resolve(__dirname, 'src/kanban.js'),
          workload: resolve(__dirname, 'src/workload.js'),
          'themes/willow': resolve(__dirname, 'src/themes/willow.js'),
          'themes/material': resolve(__dirname, 'src/themes/material.js'),
          'themes/shadcn': resolve(__dirname, 'src/themes/shadcn.js'),
        },
        fileName: (format, entryName) => {
          const ext = format === 'cjs' ? 'cjs' : 'es.js';
          return `${entryName}.${ext}`;
        },
        formats: ['es', 'cjs'],
      },
      rollupOptions: rollupOptionsStrict,
    },
  };
});
