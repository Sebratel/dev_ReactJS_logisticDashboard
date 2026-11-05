import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TopBar } from './components/layout/TopBar';
import { Loading } from './components/ui/States';
import { useSession } from './context/SessionContext';
import LoginPage from './pages/login/LoginPage';

// cada tela num pedaço próprio do bundle: quem abre a capa não baixa o Recharts das outras
const CoverPage = lazy(() => import('./pages/cover/CoverPage'));
const ProductStockAlertsPage = lazy(() => import('./pages/product-stock-alerts/ProductStockAlertsPage'));
const PatrimonyStockAlertsPage = lazy(() => import('./pages/patrimony-stock-alerts/PatrimonyStockAlertsPage'));
const PatrimonyPackingListsPage = lazy(() => import('./pages/patrimony-packing-lists/PatrimonyPackingListsPage'));
const PatrimonyAllocationsPage = lazy(() => import('./pages/patrimony-allocations/PatrimonyAllocationsPage'));
const ProductPackingListsPage = lazy(() => import('./pages/product-packing-lists/ProductPackingListsPage'));
const ProductAllocationsPage = lazy(() => import('./pages/product-allocations/ProductAllocationsPage'));
const FieldEquipmentPage = lazy(() => import('./pages/field-equipment/FieldEquipmentPage'));
const ChargedPatrimoniesPage = lazy(() => import('./pages/charged-patrimonies/ChargedPatrimoniesPage'));
const ChargedProductsPage = lazy(() => import('./pages/charged-products/ChargedProductsPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/purchase-orders/PurchaseOrdersPage'));
const StockControlsPage = lazy(() => import('./pages/stock-controls/StockControlsPage'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const CreatedObjectsPage = lazy(() => import('./pages/management/CreatedObjectsPage'));
const FlatConsumptionPage = lazy(() => import('./pages/management/FlatConsumptionPage'));
const ZteMovementsPage = lazy(() => import('./pages/management/ZteMovementsPage'));
const ZteUsedPage = lazy(() => import('./pages/management/ZteUsedPage'));
const ObsoleteEquipmentPage = lazy(() => import('./pages/management/ObsoleteEquipmentPage'));
const WarehouseProductivityPage = lazy(() => import('./pages/management/WarehouseProductivityPage'));

export default function App() {
  const { user, loading, hasManagement } = useSession();

  if (loading) return <div style={{ height: '100vh' }}><Loading text="Carregando sessão…" /></div>;
  if (!user) return <LoginPage />;

  return (
    <>
      <TopBar />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/capa" element={<CoverPage />} />
          <Route path="/produtos/alerta-estoque" element={<ProductStockAlertsPage />} />
          <Route path="/patrimonios/alerta-estoque" element={<PatrimonyStockAlertsPage />} />
          <Route path="/patrimonios/romaneio" element={<PatrimonyPackingListsPage />} />
          <Route path="/patrimonios/alocacao" element={<PatrimonyAllocationsPage />} />
          <Route path="/produtos/romaneio" element={<ProductPackingListsPage />} />
          <Route path="/produtos/alocacao" element={<ProductAllocationsPage />} />
          <Route path="/patrimonios/em-carga" element={<ChargedPatrimoniesPage />} />
          <Route path="/produtos/em-carga" element={<ChargedProductsPage />} />
          <Route path="/compras/lancamento-e-saldos" element={<PurchaseOrdersPage />} />
          <Route path="/controle/equipamentos-campo" element={<FieldEquipmentPage />} />
          <Route path="/configuracoes/controle-estoque" element={<StockControlsPage />} />
          <Route path="/administracao" element={<AdminPage />} />
          {/* seção Gerencial: sem acesso, a rota nem existe (cai na capa) — e o servidor recusa as consultas */}
          {hasManagement && (
            <>
              <Route path="/gerencial/objetos-criados" element={<CreatedObjectsPage />} />
              <Route path="/gerencial/consumo-flat" element={<FlatConsumptionPage />} />
              <Route path="/gerencial/movimentacoes-zte" element={<ZteMovementsPage />} />
              <Route path="/gerencial/zte-usados" element={<ZteUsedPage />} />
              <Route path="/gerencial/equipamentos-obsoletos" element={<ObsoleteEquipmentPage />} />
              <Route path="/gerencial/produtividade-almox" element={<WarehouseProductivityPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/capa" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
