import mysql from 'mysql2/promise';

const readEnv = (keys, fallback = '') => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
};

const DB_HOST = readEnv(['MYSQL_HOST', 'DB_HOST'], 'cluster-mysql-prod-read.movingpay.io');
const DB_PORT = Number(readEnv(['MYSQL_PORT', 'DB_PORT'], '3306'));
const DB_USER = readEnv(['MYSQL_USER', 'DB_USER'], '');
const DB_PASSWORD = readEnv(['MYSQL_PASSWORD', 'DB_PASSWORD'], '');
const DB_NAME = readEnv(['MYSQL_DATABASE', 'DB_NAME'], 'ebdb');

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { customerId, startDate, endDate } = req.body || {};

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
  if (startDate !== undefined && endDate !== undefined && startDate !== null && endDate !== null) {
    query += ' AND t.start_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
    });
    const [rows] = await connection.execute(query, params);
    return res.status(200).json(rows);
  } catch (err) {
    console.error('MySQL error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
}
