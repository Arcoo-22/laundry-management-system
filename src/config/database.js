import mysql from "mysql2";
import dotenv from "dotenv";

dotenv.config();

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

export default db;
