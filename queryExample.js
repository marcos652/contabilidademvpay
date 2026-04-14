
import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'cluster-mysql-prod-read.movingpay.io',
    port: 3306,
    user: 'marcos.vinicius',
    password: '}fTzq2NEE~a4AvP3@~~!',
    database: 'ebdb',
  });

  const query = `SELECT
    c.customers_id,
    COALESCE(FORMAT_AMOUNT(SUM(t.amount)), 0) AS total_amount,
    COALESCE(COUNT(t.nsu), 0) AS count_nsu,
    '03-2026' AS mes_ano
  FROM
    (
      SELECT 0 AS customers_id
      UNION ALL
      SELECT 237
    ) AS c
  LEFT JOIN ebdb.transactions t
    ON c.customers_id = t.customers_id
    AND t.start_date BETWEEN '2026-03-01 03:00:00' AND '2026-04-01 02:59:59'
    AND t.status = 'APPR'
  GROUP BY
    c.customers_id;`;

  try {
    const [rows] = await connection.execute(query);
    console.log(rows);
  } catch (err) {
    console.error('Erro ao executar a query:', err);
  } finally {
    await connection.end();
  }
}

main();
