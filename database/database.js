const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/barbearia.db", (err) => {
  if (err) {
    console.log("Erro ao abrir banco:", err.message);
  } else {
    console.log("SQLite conectado!");
  }
});

module.exports = db;