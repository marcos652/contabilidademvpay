
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { setupMockApi } from './vite.mock.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.MOVINGPAY_API_BASE_URL || env.VITE_MOVINGPAY_API_BASE_URL;
  const proxyToken = env.MOVINGPAY_API_TOKEN || env.VITE_MOVINGPAY_API_TOKEN;
  const authEmail = env.MOVINGPAY_AUTH_EMAIL || env.VITE_MOVINGPAY_AUTH_EMAIL || '';
  const authPassword = env.MOVINGPAY_AUTH_PASSWORD || env.VITE_MOVINGPAY_AUTH_PASSWORD || '';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // MySQL API — sempre ativa (independente de mock)
        '/api/mysql-summary': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        // MovingPay API — desativada em modo mock
        ...(process.env.USE_MOCK_API === '1' ? {} : {
          '/api/movingpay/acessar': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
            rewrite: () =>
              `/api/v3/acessar?email=${encodeURIComponent(authEmail)}&password=${encodeURIComponent(authPassword)}`,
            headers: proxyToken
              ? {
                  Authorization: `Bearer ${proxyToken}`,
                }
              : undefined,
          },
          '/api/movingpay': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/movingpay/, '/api/v3'),
            headers: proxyToken
              ? {
                  Authorization: `Bearer ${proxyToken}`,
                }
              : undefined,
          },
        }),
      },
      configureServer(server) {
        if (process.env.USE_MOCK_API === '1') {
          setupMockApi(server);
        }
      },
    },
  };
});
