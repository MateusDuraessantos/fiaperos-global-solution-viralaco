import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const apiPort = Number(process.env.SMOKE_API_PORT ?? '3300');
const webPort = Number(process.env.SMOKE_WEB_PORT ?? '4174');
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const services = [];

async function checkPort(port) {
  const server = createServer();
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  server.close();
  await once(server, 'close');
}

function startService(name, entry, cwd, args = [], env = {}) {
  const service = { name, output: '', error: undefined };
  service.child = spawn(process.execPath, [fileURLToPath(new URL(entry, root)), ...args], {
    cwd: fileURLToPath(new URL(cwd, root)),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const collect = (chunk) => {
    service.output = `${service.output}${chunk}`.slice(-12_000);
  };
  service.child.stdout.on('data', collect);
  service.child.stderr.on('data', collect);
  service.child.on('error', (error) => {
    service.error = error;
  });
  services.push(service);
  return service;
}

async function waitFor(url, service, headers = {}) {
  const deadline = Date.now() + 30_000;
  let lastError;

  while (Date.now() < deadline) {
    if (service.error) throw service.error;
    if (service.child.exitCode !== null || service.child.signalCode !== null) {
      throw new Error(`${service.name} encerrou antes de ficar disponivel.\n${service.output}`);
    }

    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(2_000) });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }

    await delay(250);
  }

  throw new Error(`Tempo esgotado: ${url}. ${lastError}\n${service.output}`);
}

function stopServices() {
  for (const { child } of services) {
    if (child.exitCode === null && child.signalCode === null) child.kill();
  }
}

process.once('SIGINT', () => {
  stopServices();
  process.exit(130);
});
process.once('SIGTERM', () => {
  stopServices();
  process.exit(143);
});

try {
  assert.notEqual(apiPort, webPort, 'As portas do smoke test devem ser diferentes.');
  await Promise.all([checkPort(apiPort), checkPort(webPort)]);

  const api = startService('API', 'apps/api/dist/main.js', 'apps/api/', [], {
    HOST: '127.0.0.1',
    PORT: String(apiPort),
    CORS_ORIGIN: webOrigin,
  });
  const web = startService('Web', 'apps/web/node_modules/vite/bin/vite.js', 'apps/web/', [
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(webPort),
    '--strictPort',
  ]);

  const health = await waitFor(`${apiOrigin}/api/health`, api, { Origin: webOrigin });
  assert.deepEqual(await health.json(), { status: 'ok', database: 'up' });
  assert.equal(health.headers.get('access-control-allow-origin'), webOrigin);
  console.log('OK: NestJS, Prisma, PostgreSQL e CORS.');

  const page = await waitFor(webOrigin, web);
  const html = await page.text();
  assert.match(html, /<div id="app"><\/div>/);
  const script = html.match(/<script[^>]*src="([^"]+)"/);
  assert.ok(script?.[1], 'O HTML deve carregar o bundle do frontend.');
  const asset = await fetch(new URL(script[1], webOrigin));
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  await asset.body?.cancel();
  console.log('OK: build do Vue servido pelo Vite.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  stopServices();
}
