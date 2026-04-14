// Vite mock middleware para uso offline
export function setupMockApi(server) {
  server.middlewares.use('/api/movingpay/acessar', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      token: 'mocked-token',
      message: 'Mocked acessar',
    }));
  });

  server.middlewares.use('/api/movingpay/transacoes', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      contador: {
        aprovadas: { quantidade: 10, valor: 123456 },
      },
      transacoes: [
        {
          start_date: '2026-03-30',
          valor_liquido: 12345,
          nsu: '001',
        },
        {
          start_date: '2026-03-31',
          valor_liquido: 23456,
          nsu: '002',
        },
      ],
    }));
  });
}
