import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { useDataSources } from '../../hooks/useDataSources';
import { requestRefresh } from '../../services/dataSourcesService';
import { cadenceLabel, dataStateOf } from '../../utils/dataState';
import { clockTime, labelInstant, timeAgo } from '../../utils/format';
import { Icon } from '../ui/Icon';
import {
  ADMIN_PATH, AREA_GROUPS, AREA_ROW_LABEL, COVER_PATH, MANAGEMENT_GROUP, PAGE_BY_PATH, PAGES, REPORT_GROUPS, SETTINGS_PATH,
} from './pages';
import { UserMenu } from './UserMenu';

/**
 * Topo + navegação. Na CAPA o topo é o próprio bloco vinho com o nome do
 * painel (e sem as abas: os cartões da capa fazem esse papel); nas outras
 * telas é a barra branca com o título da tela, o botão de configuração e as
 * abas em linhas — patrimônios, produtos & cabos, a seção Gerencial (só para
 * quem tem acesso; seis telas numa linha só) e, embaixo, as áreas próprias
 * (compras e controle), uma tela por coluna.
 * Para voltar à capa, o logo.
 *
 * O horário é o do dado da TELA aberta (as fontes dela): na de Compras, a
 * leitura de minuto em minuto; nas outras, a carga horária. O ponto diz o
 * estado: verde (em dia), dourado (mais velho que duas leituras), vermelho
 * (alguma fonte falhou), cinza (carregando a primeira vez).
 */
const SETTINGS_LABEL = PAGE_BY_PATH.get(SETTINGS_PATH)?.label ?? 'Configuração';
/** As telas das áreas próprias, em ordem, cada uma numa coluna da linha de baixo. */
const AREA_SCREENS = AREA_GROUPS.flatMap((g) => g.paths.map((path) => ({ area: g.label, path })));
const MANAGEMENT_ROW = REPORT_GROUPS.length + 1;
const MANAGEMENT_PATHS: readonly string[] = MANAGEMENT_GROUP.paths;

export function TopBar() {
  const { pathname } = useLocation();
  const { isAdmin, hasManagement } = useSession();
  // a linha do Gerencial só existe para quem tem acesso: a altura das abas (e o resto da tela) acompanha
  const areaRow = REPORT_GROUPS.length + (hasManagement ? 2 : 1);
  useEffect(() => {
    document.documentElement.style.setProperty('--nav-linhas', String(areaRow));
  }, [areaRow]);
  const { theme, toggleTheme } = useTheme();
  const current = PAGE_BY_PATH.get(pathname);
  const live = current?.live === true;
  const { data: sources } = useDataSources({ fast: live });
  const queryClient = useQueryClient();
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  // a idade mostrada é a do DADO (leitura mais antiga das fontes da tela), não a da remontagem do modelo
  const { dataAsOf, failed, intervalMs } = dataStateOf(current?.sources, sources);
  const age = dataAsOf ? Date.now() - new Date(dataAsOf).getTime() : Infinity;
  const stale = sources && intervalMs ? age > intervalMs * 2 : false;
  const dotClass = !dataAsOf ? 'loading' : failed ? 'error' : stale ? 'stale' : '';
  const dotTitle = !dataAsOf ? 'Carregando as fontes pela primeira vez'
    : failed ? 'Alguma fonte falhou na última carga — o dado mostrado é o da última leitura boa (veja a capa)'
      : `Atualização automática ${cadenceLabel(intervalMs)}`;
  // a carga horária não mexe no dado da tela ao vivo
  const reloading = !live && sources?.refresh.running;
  const whenText = reloading ? 'atualizando…'
    : !dataAsOf ? 'carregando…'
      : live ? `lido às ${clockTime(dataAsOf)} · ${cadenceLabel(intervalMs)}` : `dados lidos ${timeAgo(dataAsOf)}`;
  const title = PAGES.find((p) => p.path === pathname)?.title ?? 'Estoque Sebratel';
  const onCover = pathname === COVER_PATH;

  const refreshNow = async () => {
    setRefreshMessage(null);
    try {
      await requestRefresh();
      setRefreshMessage('Atualização iniciada — leva alguns minutos.');
      await queryClient.invalidateQueries({ queryKey: ['data-sources'] });
    } catch (err) {
      setRefreshMessage(err instanceof Error ? err.message : 'Não foi possível atualizar.');
    }
  };

  const logo = (
    <Link to={COVER_PATH} className="logo" title="Voltar para a capa">
      <img src="/logo-sebratel.svg" alt="Sebratel" />
      <span>ESTOQUE SEBRATEL</span>
    </Link>
  );

  const actions = (
    <div className="topo-acoes">
      <div className="updated">
        <span className={`live-dot ${dotClass}`} title={dotTitle} />
        <span className="quando" title={dataAsOf ? `Atualizado em ${labelInstant(dataAsOf)}` : undefined}>{whenText}</span>
        {isAdmin && (
          <button
            type="button"
            className="icon-btn"
            onClick={refreshNow}
            disabled={sources?.refresh.running}
            title={refreshMessage ?? 'Atualizar as fontes agora (administradores)'}
          >
            <span className={sources?.refresh.running ? 'spin' : ''}><Icon name="atualizar" size={15} /></span>
          </button>
        )}
        {isAdmin && (
          <NavLink
            to={ADMIN_PATH}
            className={({ isActive }) => `icon-btn${isActive ? ' ativo' : ''}`}
            title="Administração · usuários, permissões e log de edições"
            aria-label="Administração"
          >
            <Icon name="engrenagem" size={15} />
          </NavLink>
        )}
        {!onCover && (
          <NavLink
            to={SETTINGS_PATH}
            className={({ isActive }) => `icon-btn${isActive ? ' ativo' : ''}`}
            title={SETTINGS_LABEL}
            aria-label={SETTINGS_LABEL}
          >
            <Icon name="ajustes" size={15} />
          </NavLink>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          aria-label="Alternar tema"
        >
          <Icon name={theme === 'dark' ? 'sol' : 'lua'} size={15} />
        </button>
      </div>
      <UserMenu />
    </div>
  );

  if (onCover) {
    return (
      <header className="topbar topbar-capa">
        {/* sem o logo-botão aqui: ele só leva à capa, e já se está nela */}
        <div className="capa-titulo">
          <img src="/logo-circular-sebratel.png" alt="" />
          <h1>ESTOQUE SEBRATEL</h1>
          <p>Estoque, compras, romaneios e alocações — direto do Voalle</p>
        </div>
        {actions}
      </header>
    );
  }

  return (
    <>
      <header className="topbar">
        {logo}
        <h1>{title}</h1>
        {actions}
      </header>
      <nav className="pagenav" aria-label="Telas do relatório">
        {/* posição na grade: coluna 1 = grupo; cada tipo de tela ocupa um par (ícone, aba) */}
        {REPORT_GROUPS.map((group, row) => (
          <Fragment key={group.key}>
            <span
              className={`nav-grupo${row > 0 ? ' baixo' : ''}${(group.paths as readonly string[]).includes(pathname) ? ' ativo' : ''}`}
              style={{ gridRow: row + 1 }}
              aria-hidden="true"
            >
              {group.label}
            </span>
            {group.paths.map((path, col) => {
              const page = PAGE_BY_PATH.get(path);
              if (!page) return null;
              return (
                <NavLink
                  key={path}
                  to={path}
                  style={{ gridRow: row + 1, gridColumn: col * 2 + 3 }}
                  className={({ isActive }) => `${row > 0 ? 'baixo' : ''}${isActive ? ' active' : ''}`.trim() || undefined}
                  aria-label={page.label}
                >
                  {page.shortLabel ?? page.label}
                </NavLink>
              );
            })}
          </Fragment>
        ))}
        {REPORT_GROUPS[0].paths.map((path, col) => (
          <span
            key={path}
            className={`nav-icone${REPORT_GROUPS.some((g) => g.paths[col] === pathname) ? ' ativo' : ''}`}
            style={{ gridColumn: col * 2 + 2 }}
            aria-hidden="true"
          >
            <Icon name={PAGE_BY_PATH.get(path)?.icon ?? 'grade'} size={18} />
          </span>
        ))}
        {/* Gerencial: as seis telas numa linha própria, cada uma com o seu ícone */}
        {hasManagement && (
          <>
            <span
              className={`nav-grupo baixo${MANAGEMENT_PATHS.includes(pathname) ? ' ativo' : ''}`}
              style={{ gridRow: MANAGEMENT_ROW }}
              aria-hidden="true"
            >
              {MANAGEMENT_GROUP.label}
            </span>
            <div className="nav-linha-ger baixo" style={{ gridRow: MANAGEMENT_ROW }}>
              {MANAGEMENT_PATHS.map((path) => {
                const screen = PAGE_BY_PATH.get(path);
                if (!screen) return null;
                return (
                  <NavLink key={path} to={path} className={({ isActive }) => (isActive ? 'active' : undefined)} aria-label={screen.label}>
                    <Icon name={screen.icon ?? 'grade'} size={15} />
                    {screen.shortLabel ?? screen.label}
                  </NavLink>
                );
              })}
            </div>
          </>
        )}
        {/* Compras e Controle: uma linha só, uma tela por coluna, cada uma com o seu ícone e o nome da área */}
        <span
          className={`nav-grupo baixo${AREA_SCREENS.some((s) => s.path === pathname) ? ' ativo' : ''}`}
          style={{ gridRow: areaRow }}
          aria-hidden="true"
        >
          {AREA_ROW_LABEL}
        </span>
        {AREA_SCREENS.map(({ area, path }, col) => {
          const screen = PAGE_BY_PATH.get(path);
          if (!screen) return null;
          return (
            <Fragment key={path}>
              <span
                className={`nav-icone baixo${pathname === path ? ' ativo' : ''}`}
                style={{ gridRow: areaRow, gridColumn: col * 2 + 2 }}
                aria-hidden="true"
              >
                <Icon name={screen.icon ?? 'grade'} size={18} />
              </span>
              <NavLink
                to={path}
                style={{ gridRow: areaRow, gridColumn: col * 2 + 3 }}
                className={({ isActive }) => `baixo${isActive ? ' active' : ''}`}
                aria-label={screen.label}
              >
                <span className="nav-area">{area}</span>
                {screen.shortLabel ?? screen.label}
              </NavLink>
            </Fragment>
          );
        })}
        {AREA_SCREENS.length < REPORT_GROUPS[0].paths.length && (
          <span
            className="nav-vazio baixo"
            style={{ gridRow: areaRow, gridColumn: `${AREA_SCREENS.length * 2 + 2} / -1` }}
            aria-hidden="true"
          />
        )}
      </nav>
    </>
  );
}
