import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build, createServer } from 'vite';
import react from '@vitejs/plugin-react';

const directory = dirname(fileURLToPath(import.meta.url));
const configuration = {
  configFile: false,
  root: resolve(directory, 'cadrora'),
  plugins: [react()],
  build: { write: false },
  server: { host: '127.0.0.1', port: 4177, strictPort: true, fs: { allow: [resolve(directory, '..')] } },
};

if (process.argv.includes('--build')) {
  await build(configuration);
} else {
  const server = await createServer(configuration);
  try {
    await server.listen();
    server.printUrls();
  } catch (error) {
    await server.close();
    if (error instanceof Error && (('code' in error && error.code === 'EADDRINUSE') || error.message === 'Port 4177 is already in use')) {
      const existing = await fetch('http://127.0.0.1:4177/').then(response => response.text());
      if (existing.includes('Cadrora') && existing.includes('/main.tsx')) {
        console.info('Cadrora design review: http://127.0.0.1:4177/');
      } else throw error;
    } else throw error;
  }
}
