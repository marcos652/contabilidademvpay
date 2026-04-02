import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.MOVINGPAY_API_BASE_URL || env.VITE_MOVINGPAY_API_BASE_URL;
  const proxyToken = env.MOVINGPAY_API_TOKEN || env.VITE_MOVINGPAY_API_TOKEN;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
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
      },
    },
  };
});
