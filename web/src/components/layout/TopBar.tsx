import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';
import { useTheme } from '../../context/ThemeContext';
import { useDataSources } from '../../hooks/useDataSources';
import { requestRefresh } from '../../services/dataSourcesService';
import { cadenceLabel, dataStateOf } from '../../utils/dataState';
import { clockTime, labelInstant, timeAgo } from '../../utils/format';
import { Icon } from '../ui/Icon';
import { PageNav } from './PageNav';
import { ADMIN_PATH, COVER_PATH, PAGE_BY_PATH, PAGES, SETTINGS_PATH } from './pages';
import { UserMenu } from './UserMenu';

/**
 * Topo + navegação. Na CAPA o topo é o próprio bloco vinho com o nome do
 * painel (e sem as abas: os cartões da capa fazem esse papel); nas outras
 * telas é a barra branca com o título da tela, o botão de configuração e as
 * abas (`PageNav`): recolhidas na linha do grupo da tela aberta, com o bloco
 * completo — patrimônios, produtos & cabos, Gerencial (só para quem tem
 * acesso) e as áreas próprias — em "Todas as telas".
 * Para voltar à capa, o logo.
 *
 * O horário é o do dado da TELA aberta (as fontes dela): na de Compras, a
 * leitura de minuto em minuto; nas outras, a carga horária. O ponto diz o
 * estado: verde (em dia), dourado (mais velho que duas leituras), vermelho
 * (alguma fonte falhou), cinza (carregando a primeira vez).
 */
const SETTINGS_LABEL = PAGE_BY_PATH.get(SETTINGS_PATH)?.label ?? 'Configuração';

export function TopBar() {
  const { pathname } = useLocation();
  const { isAdmin } = useSession();
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
      <PageNav />
    </>
  );
}
