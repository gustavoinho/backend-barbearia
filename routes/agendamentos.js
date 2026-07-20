const express = require("express");
const router = express.Router();

const pool = require("../database/database");
const multer = require("multer");
const fs = require("fs");

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  limits:{
    fileSize: 10 * 1024 * 1024
  },
  fileFilter:(req,file,cb)=>{

    if(file.mimetype.startsWith("image/")){
      cb(null,true);
    }else{
      cb(new Error("Somente imagens são permitidas"));
    }

  }
});

// =========================
// LISTAR AGENDAMENTOS
// =========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        agendamentos.*,
        clientes.telefone
      FROM agendamentos
      LEFT JOIN clientes
      ON agendamentos.cliente_id = clientes.id
      ORDER BY agendamentos.data, agendamentos.horario
      `
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({
      erro: err.message,
    });
  }
});


// =========================
// CRIAR AGENDAMENTO
router.post("/", upload.single("comprovante"), async (req, res) => {
  console.log("BODY:", req.body);
console.log("FILE:", req.file);
  const {
    cliente,
    servico,
    data,
    horario,
    pagamento,
    total,
  } = req.body;
  console.log({
cliente,
servico,
data,
horario,
pagamento,
total
});
  
  const comprovante = req.file ? req.file.filename : null;

  if (!cliente || !servico || !data || !horario) {
    return res.status(400).json({
      erro: "Preencha todos os campos",
    });
  }
// =========================

  try {
    // verifica se está fechado
    const config = await pool.query(
      "SELECT fechado FROM configuracoes WHERE id=1"
    );

    if (config.rows[0] && config.rows[0].fechado === true) {
      return res.status(400).json({
        erro: "Estamos fechados hoje!",
      });
    }

    // bloqueia domingo
    const dia = new Date(data + "T00:00:00").getDay();

    if (dia === 0) {
      return res.status(400).json({
        erro: "Domingo não funciona",
      });
    }
    // =========================
// BLOQUEAR MESMO TELEFONE NO MESMO DIA
// =========================
const clienteTel = await pool.query(
  "SELECT telefone FROM clientes WHERE LOWER(nome)=LOWER($1)",
  [cliente]
);

if (clienteTel.rows.length > 0) {

  const telefoneCliente = clienteTel.rows[0].telefone;

  const jaAgendou = await pool.query(
    `
    SELECT a.* FROM agendamentos a
    JOIN clientes c ON a.cliente = c.nome
    WHERE c.telefone = $1 AND a.data = $2
    `,
    [telefoneCliente, data]
  );

  if (jaAgendou.rows.length > 0) {
    return res.status(400).json({
      erro: "Esse telefone já tem agendamento nesse dia"
    });
  }

}

    // verifica horário ocupado
    const existe = await pool.query(
      "SELECT * FROM agendamentos WHERE data=$1 AND horario=$2",
      [data, horario]
    );

    if (existe.rows.length > 0) {
      return res.status(400).json({
        erro: "Horário ocupado",
      });
    }

    // cria agendamento
    const result = await pool.query(
  `
  INSERT INTO agendamentos
(cliente, cliente_id, servico, data, horario, pagamento, total, comprovante)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  RETURNING id
  `,
  [
    cliente,
    servico,
    data,
    horario,
    pagamento,
    total,
    comprovante
  ]
);

    res.json({
      id: result.rows[0].id,
      mensagem: "Agendamento criado!",
    });
  } catch (err) {
    res.status(500).json({
      erro: err.message,
    });
  }
});


// =========================
// DELETAR (CONFIRMAR/CANCELAR)
// =========================
router.delete("/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const agendamento = await pool.query(
      "SELECT cliente FROM agendamentos WHERE id=$1",
      [id]
    );

    if (agendamento.rows.length === 0) {
      return res.status(404).json({
        erro: "Agendamento não encontrado",
      });
    }

    const nomeCliente = agendamento.rows[0].cliente;

    // remove agendamento
    await pool.query(
      "DELETE FROM agendamentos WHERE id=$1",
      [id]
    );

    // remove cliente (igual seu comportamento antigo)
    await pool.query(
      "DELETE FROM clientes WHERE nome=$1",
      [nomeCliente]
    );

    res.json({
      mensagem: "Agendamento removido e horário liberado",
    });
  } catch (err) {
    res.status(500).json({
      erro: err.message,
    });
  }
});

module.exports = router;