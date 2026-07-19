const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// teste de conexão (opcional mas recomendado)
pool.connect()
  .then(() => {
    console.log("PostgreSQL conectado!");
  })
  .catch((err) => {
    console.error("Erro ao conectar no banco:", err.message);
  });

module.exports = pool;