// O `tsc` só emite .js: o que não é TypeScript precisa ser copiado para `dist`
// junto — as consultas .sql (sem elas o servidor sobe sem fonte de dados) e a
// semente do cadastro de controle de estoque (usada no primeiro boot).
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const copiar = (...caminho) => cpSync(join(raiz, 'src', ...caminho), join(raiz, 'dist', ...caminho), { recursive: true });

copiar('sources', 'sql');
copiar('modules', 'stock-controls', 'seed');
