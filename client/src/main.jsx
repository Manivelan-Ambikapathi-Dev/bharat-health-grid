import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { AuthProvider } from './auth/AuthContext.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0F2747',
          colorInfo: '#0F766E',
          colorSuccess: '#16A34A',
          colorWarning: '#D97706',
          colorError: '#DC2626',
          colorLink: '#0F766E',
          borderRadius: 12,
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          colorBgLayout: '#F4F7FB',
          colorBorder: '#E2E8F0',
          colorText: '#0F172A',
          colorTextSecondary: '#475569',
        },
        components: {
          Button: { controlHeight: 36, fontWeight: 600 },
          Card: { headerBg: 'transparent' },
          Table: { headerBg: '#F8FAFC', headerColor: '#475569', rowHoverBg: '#F8FAFC' },
          Segmented: { itemSelectedBg: '#0F2747', itemSelectedColor: '#FFFFFF' },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
