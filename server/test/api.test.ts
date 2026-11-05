import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { after, before, describe, it } from 'node:test';

/**
 * Testes de contrato da API, com o app montado sem banco (createApp não
 * dispara a carga). O login fica ligado com um ID de cliente fictício para
 * provar que nenhuma rota de dados responde sem token.
 */
process.env.AUTH_ENABLED = 'true';
process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
process.env.PUBLIC_DIR = '/caminho/que/nao/existe';

let server: Server;
let base = '';

before(async () => {
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

after(() => {
  server.close();
});

describe('API', () => {
  it('health é público e não expõe detalhe das fontes', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json() as { success: boolean; data: Record<string, unknown> };
    assert.equal(body.success, true);
    assert.deepEqual(Object.keys(body.data).sort(), ['modelLoaded', 'status']);
  });

  it('configuração do login é pública e não tem segredo', async () => {
    const body = await (await fetch(`${base}/auth/config`)).json() as { data: Record<string, unknown> };
    assert.deepEqual(Object.keys(body.data).sort(), ['allowedDomain', 'clientId', 'enabled']);
  });

  it('relatório sem token devolve 401 no envelope padrão', async () => {
    const res = await fetch(`${base}/reports/product-allocations`);
    assert.equal(res.status, 401);
    const body = await res.json() as { success: boolean; error: { code: string } };
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'AUTH_TOKEN_MISSING');
  });

  it('token com formato inválido nem chega ao Google', async () => {
    const res = await fetch(`${base}/reports/product-allocations`, { headers: { Authorization: 'Bearer <script>' } });
    assert.equal(res.status, 401);
  });

  it('cadastro de controle de estoque não lê nem grava sem login', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const calls: Array<[string, string]> = [
      ['GET', '/stock-controls'], ['GET', '/stock-controls/export'], ['POST', '/stock-controls'],
      ['PUT', `/stock-controls/${id}`], ['DELETE', `/stock-controls/${id}`], ['GET', '/products/5601'],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' || method === 'PUT' ? '{}' : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  it('administração e registro de login exigem login', async () => {
    const calls: Array<[string, string]> = [
      ['GET', '/users'], ['PATCH', '/users/ana%40exemplo.com.br'], ['GET', '/audit-events'], ['POST', '/auth/logins'],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: method === 'PATCH' ? '{"role":"ADMIN"}' : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  it('telas de Compras, equipamentos para campo e em carga (e as exportações) exigem login', async () => {
    for (const path of ['/reports/purchase-orders', '/reports/purchase-orders/exports/items', '/reports/purchase-orders/exports/balances', '/reports/field-equipment', '/reports/field-equipment/exports/new-detail', '/reports/charged-patrimonies', '/reports/charged-patrimonies/exports/detail', '/reports/charged-products', '/reports/charged-products/exports/detail']) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 401, path);
    }
  });

  it('seção Gerencial e a lista da produtividade exigem login', async () => {
    const calls: Array<[string, string]> = [
      ['GET', '/management-reports/created-objects'], ['GET', '/management-reports/flat-consumption'],
      ['GET', '/management-reports/zte-movements'], ['GET', '/management-reports/zte-used'],
      ['GET', '/management-reports/obsolete-equipment'], ['GET', '/management-reports/warehouse-productivity'],
      ['GET', '/productivity-staff'], ['PUT', '/productivity-staff'],
    ];
    for (const [method, path] of calls) {
      const res = await fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: method === 'PUT' ? '{"names":["X"]}' : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  it('atualização manual exige login', async () => {
    const res = await fetch(`${base}/data-sources/refresh`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('rota inexistente da API é 404 em JSON, não a SPA', async () => {
    const res = await fetch(`${base}/nao-existe`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') ?? '', /json/);
  });

  it('cabeçalhos de segurança presentes', async () => {
    const res = await fetch(`${base}/health`);
    assert.ok(res.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');
  });
});
