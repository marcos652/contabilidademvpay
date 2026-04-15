import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: 'cluster-mysql-prod-read.movingpay.io',
  port: 3306,
  user: 'marcos.vinicius',
  password: '}fTzq2NEE~a4AvP3@~~!',
  database: 'ebdb',
};

// Normaliza datas para garantir 00:00:00 no início e 23:59:59 no fim
function normalizeDateRange(start, end) {
  const s = String(start || '').trim().slice(0, 10); // pega só YYYY-MM-DD
  const e = String(end || '').trim().slice(0, 10);
  return {
    startDate: s ? `${s} 00:00:00` : null,
    endDate: e ? `${e} 23:59:59.999` : null,
  };
}

app.post('/api/mysql-summary', async (req, res) => {
  const { customerId } = req.body;
  const { startDate, endDate } = normalizeDateRange(req.body.startDate, req.body.endDate);

  let query = `SELECT
    t.customers_id,
    COALESCE(SUM(t.amount), 0) AS total_amount,
    COALESCE(COUNT(t.nsu), 0) AS count_nsu
  FROM ebdb.transactions t
  WHERE t.status = 'APPR'`;
  const params = [];

  if (customerId) {
    query += ' AND t.customers_id = ?';
    params.push(customerId);
  }
  if (startDate && endDate) {
    query += ' AND t.start_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  // Não agrupa mais por mês

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(query, params);
    await connection.end();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MySQL summary API listening on port ${PORT}`);
});
