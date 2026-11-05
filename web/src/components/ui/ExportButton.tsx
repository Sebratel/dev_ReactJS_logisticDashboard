import { useState } from 'react';
import { downloadReportExport, type ReportName, type ReportQuery } from '../../services/reportsService';
import { Icon } from './Icon';

interface ExportButtonProps {
  report: ReportName;
  table: string;
  query: ReportQuery;
}

/**
 * Baixa a tabela COMPLETA do recorte (CSV gerado no servidor): a tela mostra
 * no máximo 1.000 linhas, o arquivo leva todas.
 */
export function ExportButton({ report, table, query }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const click = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await downloadReportExport(report, table, query);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Falha ao exportar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn-exportar"
      onClick={click}
      disabled={busy}
      title={failed ?? 'Exportar todas as linhas do recorte em CSV'}
    >
      <Icon name={failed ? 'alerta' : 'baixar'} size={13} />
      {busy ? 'gerando…' : 'CSV'}
    </button>
  );
}
