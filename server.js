require("dotenv").config();
const multer = require ("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });
const express = require("express");
const cors = require("cors");
const pool = require("./database/database");
const agendamentosRoutes = require("./routes/agendamentos");

const app = express();
app.use("/uploads", express.static("uploads"));

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

async function criarBanco() {
  try {
    await pool.query(`

-- =========================
-- TABELA DE CLIENTES
-- =========================
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT UNIQUE NOT NULL
);


-- =========================
-- TABELA DE SERVIÇOS
-- =========================
CREATE TABLE IF NOT EXISTS servicos (
  id SERIAL PRIMARY KEY,
  nome TEXT,
  preco NUMERIC(10,2),
  codigo TEXT UNIQUE,
  imagem TEXT
);


-- =========================
-- TABELA DE AGENDAMENTOS
-- =========================
CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  cliente TEXT,
  servico TEXT,
  data DATE,
  horario TEXT,
  status TEXT,
  pagamento TEXT,
  total INTEGER
);

ALTER TABLE agendamentos
ADD COLUMN IF NOT EXISTS comprovante
TEXT;

-- =========================
-- TABELA DE CONFIGURAÇÕES
-- =========================
CREATE TABLE IF NOT EXISTS configuracoes (
  id SERIAL PRIMARY KEY,
  fechado BOOLEAN DEFAULT false
);


-- garante que exista uma config
INSERT INTO configuracoes (id, fechado)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;


-- =========================
-- TABELA DE COMUNICADOS
-- =========================
CREATE TABLE IF NOT EXISTS comunicados (
  id SERIAL PRIMARY KEY,
  mensagem TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================
-- INSERIR SERVIÇOS PADRÃO
-- =========================
INSERT INTO servicos (nome, preco, codigo, imagem)
VALUES
('Corte e sobrancelha',45,'corte','corte.jpg'),
('Sobrancelha na gilete',10,'sg','sg.jpg'),
('Corte e barba',55,'cb','cb.jpg'),
('Corte barba e sobrancelha',65,'csb','csb.jpg'),
('Barba somente',25,'barba','barba.jpg'),
('Pezinho do cabelo',12,'pe','pe.jpg'),
('Luzes (a partir de 90 - valor a combinar)',90,'luzes','luzes.jpg')
ON CONFLICT (codigo) DO UPDATE SET
nome = EXCLUDED.nome,
preco = EXCLUDED.preco,
imagem = EXCLUDED.imagem;
`);
console.log("Banco PostgreSQL preparado!");
  }catch(err){
    console.log("Erro criando banco:",err.message);
  }
  }
  criarBanco();

// rotas de agendamentos
app.use("/agendamentos", agendamentosRoutes);

// rota teste
app.get("/", (req, res) => {
  res.send("API da barbearia funcionando");
});


// =========================
// COMUNICADOS
// =========================

// criar comunicado
app.post("/comunicados", async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem) {
    return res.status(400).json({ erro: "Mensagem vazia" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO comunicados(mensagem) VALUES($1) RETURNING id",
      [mensagem]
    );

    res.json({
      id: result.rows[0].id,
      mensagem,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// buscar comunicados
app.get("/comunicados", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM comunicados ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// excluir comunicado
app.delete("/comunicados/:id", async (req, res) => {
  const id = req.params.id;

  try {
    await pool.query("DELETE FROM comunicados WHERE id=$1", [id]);

    res.json({ mensagem: "Comunicado removido" });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// =========================
// CLIENTES
// =========================

app.post("/clientes", async (req, res) => {
  const { nome, telefone } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({
      erro: "Nome e telefone obrigatórios"
    });
  }

  try {

    // verifica se cliente já existe
    const clienteExiste = await pool.query(
      "SELECT * FROM clientes WHERE telefone=$1",
      [telefone]
    );


    // se já existe, não cria outro
    if(clienteExiste.rows.length > 0){

      return res.json({
        mensagem:"Cliente já cadastrado",
        cliente: clienteExiste.rows[0]
      });

    }


    // se não existe, cria
    await pool.query(
      "INSERT INTO clientes(nome, telefone) VALUES($1,$2)",
      [nome, telefone]
    );


    res.json({
      mensagem:"Cliente salvo!"
    });


  } catch(err){

    res.status(500).json({
      erro:err.message
    });

  }

});
app.get("/clientes", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clientes");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// =========================
// SERVIÇOS
// =========================

app.post("/servicos", async (req, res) => {
  const { nome, preco, imagem } = req.body;

  if (!nome || !preco) {
    return res.status(400).json({
      erro: "Nome e preço obrigatórios",
    });
  }

  try {
    const result = await pool.query(
      "INSERT INTO servicos(nome,preco,imagem) VALUES($1,$2,$3) RETURNING id",
      [nome, preco, imagem]
    );

    res.json({
      id: result.rows[0].id,
      nome,
      preco,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get("/servicos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM servicos");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// =========================
// HORÁRIOS
// =========================

app.get("/horarios/:data", async (req, res) => {
  const data = req.params.data;

  const dia = new Date(data + "T00:00:00").getDay();

  if (dia === 0) {
    return res.json([]); // domingo fechado
  }

  const horarios = [
    "09:00","09:40","10:20","11:00","11:40","12:20",
    "13:00","13:40","14:20","15:00","15:40","16:20",
    "17:00","17:40","18:20","19:00","19:40"
  ];

  try {
    const result = await pool.query(
      "SELECT horario FROM agendamentos WHERE data=$1",
      [data]
    );

    const ocupados = result.rows.map(item => item.horario);

    const resposta = horarios.map(h => ({
      horario: h,
      ocupado: ocupados.includes(h),
    }));

    res.json(resposta);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// =========================
// CONFIGURAÇÃO (ABERTO/FECHADO)
// =========================

app.get("/configuracao", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT fechado FROM configuracoes WHERE id=1"
    );

    res.json({
      fechado: result.rows[0]?.fechado === true,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put("/configuracao", async (req, res) => {
  const { fechado } = req.body;

  if (typeof fechado !== "boolean") {
    return res.status(400).json({ erro: "Valor inválido" });
  }

  try {
    await pool.query(
      "UPDATE configuracoes SET fechado=$1 WHERE id=1",
      [fechado]
    );

    res.json({ fechado });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// =========================

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});