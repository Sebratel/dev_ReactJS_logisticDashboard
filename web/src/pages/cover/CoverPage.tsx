import { Link } from 'react-router-dom';
import {
  AREA_GROUPS, COVER_PATH, MANAGEMENT_GROUP, PAGE_BY_PATH, PAGES, REPORT_GROUPS, type PageDefinition,
} from '../../components/layout/pages';
import { Icon } from '../../components/ui/Icon';
import { Banner } from '../../components/ui/States';
import { useSession } from '../../context/SessionContext';
import { useDataSources } from '../../hooks/useDataSources';
import type { DataSourcesState } from '../../services/types';
import { freshnessOf } from './freshness';

const DASHBOARD_NAME = 'Estoque Sebratel';

const SCREENS = PAGES.filter((p) => p.path !== COVER_PATH);
/**
 * Duas colunas: patrimônios à esquerda, produtos & cabos à direita, na mesma
 * ordem (alerta, romaneio, alocação) — cada linha compara a mesma tela.
 * A ordem aqui é a do DOM; o CSS preenche coluna por coluna.
 */
const REPORTS = REPORT_GROUPS.flatMap((g) => g.paths)
  .map((path) => PAGE_BY_PATH.get(path))
  .filter((p): p is PageDefinition => p !== undefined);
/** Compras e Controle: áreas próprias, abaixo das duas colunas (grade igual, cartões da mesma largura). */
const AREAS = AREA_GROUPS.flatMap((g) => g.paths)
  .map((path) => PAGE_BY_PATH.get(path))
  .filter((p): p is PageDefinition => p !== undefined);
const SETTINGS = SCREENS.filter((p) => p.isSetting);
/** Seção Gerencial: o bloco só aparece para quem tem acesso. */
const MANAGEMENT = MANAGEMENT_GROUP.paths
  .map((path) => PAGE_BY_PATH.get(path))
  .filter((p): p is PageDefinition => p !== undefined);

function ScreenCard({ page, state }: { page: PageDefinition; state: DataSourcesState | undefined }) {
  const fresh = freshnessOf(page, state);
  return (
    <Link to={page.path} className={`tela-card${page.isSetting ? ' tela-config' : ''}`}>
      <span className="tela-icone"><Icon name={page.icon ?? 'grade'} size={17} /></span>
      <span className="tela-txt">
        <b>{page.label}</b>
        {page.description && <span>{page.description}</span>}
        <small className={`tela-dado dado-${fresh.tone}`} title={fresh.title}>
          <Icon name={fresh.tone === 'error' ? 'alerta' : 'relogio'} size={11} /> {fresh.text}
        </small>
      </span>
      <Icon name="direita" size={15} className="tela-seta" />
    </Link>
  );
}

/**
 * CAPA — boas-vindas com as telas do painel, cada uma com a hora do dado.
 * O nome do painel fica no topo vinho (TopBar, variante da capa).
 */
export default function CoverPage() {
  const { user, config, hasManagement } = useSession();
  const { data: sources } = useDataSources();
  // sem login o "usuário" é fictício ("Modo sem autenticação"): melhor não cumprimentá-lo pelo nome
  const firstName = config?.enabled ? (user?.name ?? '').trim().split(/\s+/)[0] : '';
  const canEdit = user?.role === 'ADMIN' || user?.role === 'EDITOR';

  return (
    <main className="page sem-filtros capa-pagina">
      <section className="boas-vindas" aria-labelledby="boas-vindas-titulo">
        <div className="bv-texto">
          <span className="bv-selo"><Icon name="brilho" size={11} /> Boas-vindas</span>
          <h2 id="boas-vindas-titulo">{firstName ? `Olá, ${firstName}!` : 'Olá!'}</h2>
          <p className="bv-onde">Você está em <b>{DASHBOARD_NAME}</b>.</p>
          <p className="bv-intro">
            Aqui você acompanha o saldo de estoque, os pedidos de compra, o que o almoxarifado envia em romaneio, o
            que é alocado em protocolo, o que está em carga com cada pessoa e os equipamentos enviados a campo.
            Escolha uma das telas para começar.
          </p>
          {canEdit && (
            <p className="bv-nota">
              Você pode alterar mínimo, alerta e situação dos produtos em{' '}
              <Link to="/configuracoes/controle-estoque">Configuração · Controle de estoque</Link>.
            </p>
          )}
        </div>

        <nav className="bv-telas" aria-label="Telas do painel">
          <h3 className="capa-secao-titulo">Telas do painel</h3>
          <div className="capa-telas">
            {REPORTS.map((p) => <ScreenCard key={p.path} page={p} state={sources} />)}
          </div>
          {hasManagement && (
            <>
              <h3 className="capa-secao-titulo capa-secao-ger">
                <Icon name="cadeado" size={11} /> Gerencial · acesso restrito
              </h3>
              <div className="capa-extra">
                {MANAGEMENT.map((p) => <ScreenCard key={p.path} page={p} state={sources} />)}
              </div>
            </>
          )}
          {AREAS.length > 0 && (
            <div className="capa-extra">
              {AREAS.map((p) => <ScreenCard key={p.path} page={p} state={sources} />)}
            </div>
          )}
          {SETTINGS.length > 0 && (
            <div className="capa-config">
              {SETTINGS.map((p) => <ScreenCard key={p.path} page={p} state={sources} />)}
            </div>
          )}
        </nav>
      </section>

      {sources && sources.modelVersion > 0 && !sources.stockControlAvailable && (
        <Banner>
          O <b>cadastro de controle de estoque</b> está vazio ou não pôde ser lido. As telas de alerta de estoque ficam
          sem mínimo, alerta, categoria e lead time até ele voltar
          (<Link to="/configuracoes/controle-estoque">Configuração · Controle de estoque</Link>).
        </Banner>
      )}

    </main>
  );
}
