import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import { applyInitialTheme } from './utils/theme';
import './styles/theme.css';
import './styles/login.css';

// antes do primeiro render: sem isto a tela pisca clara antes de escurecer
applyInitialTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
      // com o padrão ('online') a consulta PAUSA quando a API não responde e o
      // card fica em branco para sempre; com 'always' a falha vira erro visível
      networkMode: 'always',
      staleTime: 30_000,
    },
    mutations: { networkMode: 'always' },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('elemento #root não encontrado');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          {/* por dentro do QueryClientProvider: ao encerrar a sessão ele limpa o cache */}
          <SessionProvider>
            <App />
          </SessionProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
