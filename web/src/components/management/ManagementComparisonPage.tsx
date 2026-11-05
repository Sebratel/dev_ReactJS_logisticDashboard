import type { ReactNode } from 'react';
import { ErrorBanner, Loading } from '../ui/States';
import { useReport } from '../../hooks/useReport';
import type { ComparisonKind } from '../../services/types';
import { int } from '../../utils/format';
import { ComparisonDashboard } from './ComparisonDashboard';

type ComparisonReportName = 'created-objects' | 'flat-consumption' | 'zte-movements' | 'zte-used' | 'obsolete-equipment';

interface ManagementComparisonPageProps {
  report: ComparisonReportName;
  loadingText: string;
  historyNote: string;
  intro?: ReactNode;
  notes?: Partial<Record<ComparisonKind, string>>;
  format?: (value: number) => string;
}

const NO_FILTERS = {};

/** Uma tela Gerencial de comparação: sem filtros (os períodos são os do relatório, contados a partir de hoje). */
export function ManagementComparisonPage({ report, loadingText, historyNote, intro, notes, format = int }: ManagementComparisonPageProps) {
  const { data, error, isPending } = useReport(report, NO_FILTERS);
  return (
    <main className="page sem-filtros">
      {error && <ErrorBanner error={error} />}
      {isPending && !data && <Loading text={loadingText} />}
      {data && <ComparisonDashboard report={data} historyNote={historyNote} intro={intro} notes={notes} format={format} />}
    </main>
  );
}
