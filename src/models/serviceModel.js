import db from "../config/database.js";

const Service = {
  getAll: () => {
    return new Promise((resolve, reject) => {
      db.query("SELECT * FROM tbl_services ORDER BY service_id ASC", (err, results) => {
        if (err) return reject(err);
        resolve(results || []);
      });
    });
  },

  getById: (id) => {
    return new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM tbl_services WHERE service_id = ?",
        [id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results && results.length ? results[0] : null);
        }
      );
    });
  },

  getByName: (service_name) => {
    return new Promise((resolve, reject) => {
      const query = `
      SELECT * FROM tbl_services 
      WHERE service_name LIKE ?`;
      const searchTerm = `%${service_name}%`;

      db.query(query, [searchTerm], (err, results) => {
        if (err) return reject(err);
        resolve(results || []);
      });
    });
  },

  create: (serviceData) => {
    const { service_name, price_per_kilo, description } = serviceData;
    return new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO tbl_services (service_name, price_per_kilo, description) VALUES (?, ?, ?)",
        [service_name, price_per_kilo, description],
        (err, results) => {
          if (err) return reject(err);
          resolve({ id: results.insertId, service_id: results.insertId, ...serviceData });
        }
      );
    });
  },

  update: (id, serviceData) => {
    const { service_name, price_per_kilo, description } = serviceData;
    return new Promise((resolve, reject) => {
      db.query(
        "UPDATE tbl_services SET service_name = ?, price_per_kilo = ?, description = ? WHERE service_id = ?",
        [service_name, price_per_kilo, description, id],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });
  },

  delete: (id) => {
    return new Promise((resolve, reject) => {
      db.query("DELETE FROM tbl_services WHERE service_id = ?", [id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  },
};

export default Service;
