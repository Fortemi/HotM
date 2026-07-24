import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = '/app/hotm-ui';
const port = Number.parseInt(process.env.HOTM_PORT ?? '4180', 10);
const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function safeStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = resolve(root, `.${decoded}`);
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null;
}

function sendFile(request, response, path) {
  const extension = extname(path).toLowerCase();
  response.statusCode = 200;
  response.setHeader('Content-Type', mimeTypes.get(extension) ?? 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  if (path.endsWith('/index.html') || path.endsWith('/env-config.js')) {
    response.setHeader('Cache-Control', 'no-store');
  } else if (path.includes(`${sep}assets${sep}`)) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(path).pipe(response);
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/healthz') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end('{"status":"ok","service":"hotm-ui"}\n');
    return;
  }
  if (url.pathname === '/env-config.js') {
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/javascript; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(
      `window.__RUNTIME_CONFIG__ = ${JSON.stringify({ VITE_API_BASE_URL: apiBaseUrl })};\n`,
    );
    return;
  }

  const requested = safeStaticPath(url.pathname);
  if (!requested) {
    response.writeHead(400).end();
    return;
  }

  try {
    const file = statSync(requested).isDirectory() ? resolve(requested, 'index.html') : requested;
    if (statSync(file).isFile()) {
      sendFile(request, response, file);
      return;
    }
  } catch {
    // SPA fallback below.
  }
  sendFile(request, response, resolve(root, 'index.html'));
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`HotM UI listening on 0.0.0.0:${port}\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
