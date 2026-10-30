import mysql from "mysql2";
import dotenv from "dotenv";

// Supports both ".env" and ".env_local" (first file wins for any duplicate key)
dotenv.config({ path: [".env", ".env_local"], quiet: true });

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "db_laundry",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Connection verification
export const dbConnect = () =>
  new Promise((resolve, reject) => {
    db.getConnection((err, connection) => {
      if (err) {
        console.error("Error connecting to MySQL database:", err);
        return reject(err);
      }
      console.log("Connected to MySQL database");
      connection.release();
      resolve(db);
    });
  });

// Run several queries atomically. `fn` receives a promise-based connection:
//   const [rows] = await conn.query("SELECT ...", [params]);
// Commits when fn resolves, rolls back (and rethrows) when it throws.
export const withTransaction = async (fn) => {
  const conn = await db.promise().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore rollback failure */ }
    throw err;
  } finally {
    conn.release();
  }
};

export default db;