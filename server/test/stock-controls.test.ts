import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AuthenticatedUser } from '../src/common/auth/auth.middleware.js';

/**
 * Cadastro de controle de estoque contra um diretório de dados temporário:
 * nada aqui toca o cadastro de verdade (`server/data`).
 */
const dataPath = mkdtempSync(join(tmpdir(), 'stock-controls-'));
process.env.DATA_PATH = dataPath;

const editor: AuthenticatedUser = { email: 'editor@exemplo.com.br', name: 'Editor', picture: null, role: 'EDITOR' };
const valid = {
  code: 99_999_001,
  category: 'TESTE',
  item: 'ITEM DE TESTE',
  baseName: 'SEDE - PORTO ALEGRE',
  alertLevel: 20,
  minimumLevel: 10,
  buyer: 'COMPRAS',
  leadTimeDays: 15,
  externalProcess: null,
};

type Service = typeof import('../src/modules/stock-controls/stock-control.service.js');
let service: Service;
let changes = 0;

before(async () => {
  service = await import('../src/modules/stock-controls/stock-control.service.js');
  service.onStockControlChange(() => { changes += 1; });
});

after(() => {
  rmSync(dataPath, { recursive: true, force: true });
});

const errorOf = (fn: () => unknown): { status?: number; code?: string; name?: string } => {
  try {
    fn();
  } catch (err) {
    return err as { status?: number; code?: string; name?: string };
  }
  assert.fail('deveria ter lançado');
};

describe('cadastro de controle de estoque', () => {
  it('no primeiro uso nasce da planilha oficial e grava o arquivo', () => {
    const { items } = service.listStockControls();
    assert.equal(items.length, 831);
    assert.ok(items.every((i) => i.updatedBy === 'Planilha oficial (importação inicial)'));
    assert.ok(items.every((i) => i.buyer), 'todo item da planilha oficial tem comprador');
    const onDisk = JSON.parse(readFileSync(join(dataPath, 'stock-controls.json'), 'utf8')) as { items: unknown[] };
    assert.equal(onDisk.items.length, 831);
  });

  it('cadastra com o e-mail de quem alterou e avisa as telas', () => {
    const before = changes;
    const created = service.createStockControl(valid, editor);
    assert.equal(created.updatedBy, editor.email);
    assert.equal(created.buyer, 'COMPRAS');
    assert.equal(changes, before + 1);
    assert.ok(service.listStockControls().items.some((i) => i.id === created.id));
  });

  it('recusa o mesmo código na mesma base (409)', () => {
    const err = errorOf(() => service.createStockControl(valid, editor));
    assert.equal(err.status, 409);
    assert.equal(err.code, 'STOCK_CONTROL_ALREADY_EXISTS');
  });

  it('aceita o mesmo código em outra base', () => {
    const other = service.createStockControl({ ...valid, baseName: 'BASE OPERACIONAL - CANOAS' }, editor);
    assert.equal(other.baseName, 'BASE OPERACIONAL - CANOAS');
  });

  it('alerta menor que o mínimo é regra de negócio (422)', () => {
    const err = errorOf(() => service.createStockControl({ ...valid, code: 99_999_002, alertLevel: 5 }, editor));
    assert.equal(err.status, 422);
  });

  it('não aceita campo fora do formulário nem base desconhecida', () => {
    assert.equal(errorOf(() => service.createStockControl({ ...valid, code: 99_999_003, updatedBy: 'outra@pessoa' }, editor)).name, 'ZodError');
    assert.equal(errorOf(() => service.createStockControl({ ...valid, code: 99_999_003, baseName: 'BASE X' }, editor)).name, 'ZodError');
    assert.equal(errorOf(() => service.createStockControl({ ...valid, code: 99_999_003, minimumLevel: -1 }, editor)).name, 'ZodError');
  });

  it('edita mantendo a data de criação e trocando o autor', () => {
    const current = service.listStockControls().items.find((i) => i.code === valid.code && i.baseName === valid.baseName)!;
    const updated = service.updateStockControl(current.id, { ...valid, minimumLevel: 12, item: '  ITEM   EDITADO ' }, { ...editor, email: 'outro@exemplo.com.br' });
    assert.equal(updated.createdAt, current.createdAt);
    assert.equal(updated.minimumLevel, 12);
    assert.equal(updated.item, 'ITEM EDITADO');
    assert.equal(updated.updatedBy, 'outro@exemplo.com.br');
  });

  it('o log de edições guarda quem mudou o quê, de quanto para quanto', async () => {
    const { listAudit } = await import('../src/modules/audit/audit.service.js');
    const [last] = listAudit(1);
    assert.equal(last?.action, 'stock-control.update');
    assert.equal(last?.email, 'outro@exemplo.com.br');
    assert.equal(last?.target, `Código ${valid.code} · ${valid.baseName}`);
    assert.deepEqual(last?.changes, [
      { field: 'Item', from: 'ITEM DE TESTE', to: 'ITEM EDITADO' },
      { field: 'Estoque mínimo', from: 10, to: 12 },
    ]);
    const created = listAudit(10).find((e) => e.action === 'stock-control.create');
    assert.ok(created?.changes.some((c) => c.field === 'Alerta de estoque' && c.from === null && c.to === 20));
  });

  it('editar para uma base onde o código já existe é conflito', () => {
    const current = service.listStockControls().items.find((i) => i.code === valid.code && i.baseName === valid.baseName)!;
    const err = errorOf(() => service.updateStockControl(current.id, { ...valid, baseName: 'BASE OPERACIONAL - CANOAS' }, editor));
    assert.equal(err.status, 409);
  });

  it('exclui; excluir de novo é 404; id malformado nem procura', () => {
    const current = service.listStockControls().items.find((i) => i.code === valid.code && i.baseName === valid.baseName)!;
    service.deleteStockControl(current.id, editor);
    assert.equal(errorOf(() => service.deleteStockControl(current.id, editor)).status, 404);
    assert.equal(errorOf(() => service.deleteStockControl('../../etc/passwd', editor)).name, 'ZodError');
  });

  it('arquivo gravado antes do campo comprador continua legível', () => {
    const file = join(dataPath, 'stock-controls.json');
    const store = JSON.parse(readFileSync(file, 'utf8')) as { items: Array<Record<string, unknown>> };
    for (const item of store.items) delete item.buyer;
    writeFileSync(file, JSON.stringify(store), 'utf8');
    const { items } = service.listStockControls();
    assert.ok(items.length > 0);
    assert.ok(items.every((i) => i.buyer === null));
  });

  it('arquivo corrompido trava a gravação em vez de apagar o cadastro', () => {
    const file = join(dataPath, 'stock-controls.json');
    writeFileSync(file, '{ "items": [ corrompido', 'utf8');
    const err = errorOf(() => service.createStockControl({ ...valid, code: 99_999_004 }, editor));
    assert.equal(err.status, 500);
    assert.equal(err.code, 'STOCK_CONTROL_STORE_UNREADABLE');
    assert.equal(readFileSync(file, 'utf8'), '{ "items": [ corrompido');
  });
});
