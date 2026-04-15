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

const FIREBASE_PROJECT_ID = readEnv(
  ['FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'],
  'contabilidademvpay'
);

// Verificação leve de token Firebase (sem Admin SDK pesado)
// Valida a assinatura via Google public keys
async function verifyFirebaseToken(token) {
  if (!token) return null;

  try {
    // Decodifica o payload do JWT sem verificar assinatura (para extrair campos)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );

    // Valida campos básicos
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub) return null;
    if (payload.exp && payload.exp < now) return null;
    if (payload.iss && !payload.iss.includes(FIREBASE_PROJECT_ID)) return null;

    // Verifica via Google tokeninfo endpoint para garantir que o token é válido
    const verifyUrl = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${readEnv(['FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY'], 'AIzaSyApwNR-FiAuYpQEfzVGkm9X3B8xTdTIJ2s')}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!verifyRes.ok) return null;

    const verifyData = await verifyRes.json();
    if (!verifyData.users || verifyData.users.length === 0) return null;

    return {
      uid: verifyData.users[0].localId,
      email: verifyData.users[0].email || '',
    };
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Verificar autenticação Firebase
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ message: 'Token de autenticação não fornecido.' });
  }

  const user = await verifyFirebaseToken(token);
  if (!user) {
    return res.status(403).json({ message: 'Token inválido ou expirado. Faça login novamente.' });
  }

  // Usuário autenticado — prosseguir com a consulta
  const { customerId } = req.body || {};

  // Normaliza datas: startDate 00:00:00, endDate 23:59:59
  const rawStart = String(req.body?.startDate || '').trim().slice(0, 10);
  const rawEnd = String(req.body?.endDate || '').trim().slice(0, 10);
  const startDate = rawStart ? `${rawStart} 00:00:00` : null;
  const endDate = rawEnd ? `${rawEnd} 23:59:59.999` : null;

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
