require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./database/database");
const agendamentosRoutes = require("./routes/agendamentos");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
// cria tabela de configurações antes das rotas usarem ela
db.serialize(()=>{


  db.run(`
    CREATE TABLE IF NOT EXISTS configuracoes(
      id INTEGER PRIMARY KEY,
      fechado INTEGER DEFAULT 0
    )
  `);


  db.run(`
    INSERT OR IGNORE INTO configuracoes(id, fechado)
    VALUES(1,0)
  `);

});


// conecta rotas de agendamento
app.use("/agendamentos", agendamentosRoutes);


// adiciona pagamento se ainda não existir
db.run(
  `
  ALTER TABLE agendamentos 
  ADD COLUMN pagamento TEXT
  `,
  (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.log("Erro pagamento:", err.message);
    }
  }
);

db.run(
  `
  ALTER TABLE agendamentos 
  ADD COLUMN total REAL
  `,
  (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.log("Erro total:", err.message);
    }
  }
);
// rota teste
app.get("/", (req,res)=>{
  res.send("API da barbearia funcionando");
});
db.run(
  `
  ALTER TABLE servicos 
  ADD COLUMN imagem TEXT
  `,
  (err) => {
    if (err && !err.message.includes("duplicate column")) {
      console.log("Erro imagem:", err.message);
    }
  }
);
// tabela de comunicados

db.run(`
CREATE TABLE IF NOT EXISTS comunicados(
id INTEGER PRIMARY KEY AUTOINCREMENT,
mensagem TEXT NOT NULL,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

// criar comunicado

app.post("/comunicados",(req,res)=>{

const {mensagem}=req.body;


if(!mensagem){
return res.status(400).json({
erro:"Mensagem vazia"
});
}


db.run(
"INSERT INTO comunicados(mensagem) VALUES(?)",
[mensagem],

function(err){

if(err){
return res.status(500).json({
erro:err.message
});
}


res.json({
id:this.lastID,
mensagem
});


});


});



// buscar comunicados

app.get("/comunicados",(req,res)=>{


db.all(
"SELECT * FROM comunicados ORDER BY id DESC",
[],
(err,rows)=>{


if(err){
return res.status(500).json({
erro:err.message
});
}


res.json(rows);


});


});



// excluir comunicado

app.delete("/comunicados/:id",(req,res)=>{


const id=req.params.id;


db.run(
"DELETE FROM comunicados WHERE id=?",
[id],

(err)=>{


if(err){
return res.status(500).json({
erro:err.message
});
}


res.json({
mensagem:"Comunicado removido"
});


});

});

// criar tabelas
db.serialize(()=>{


db.run(`
CREATE TABLE IF NOT EXISTS clientes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
nome TEXT NOT NULL,
telefone TEXT,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);



db.run(`
CREATE TABLE IF NOT EXISTS servicos(
id INTEGER PRIMARY KEY AUTOINCREMENT,
nome TEXT NOT NULL,
preco REAL,
imagem TEXT
)
`);



db.run(`
CREATE TABLE IF NOT EXISTS agendamentos(
id INTEGER PRIMARY KEY AUTOINCREMENT,
cliente TEXT NOT NULL,
servico TEXT NOT NULL,
data TEXT NOT NULL,
horario TEXT NOT NULL,
status TEXT DEFAULT 'pendente',
pagamento TEXT,
criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);



db.run(`
CREATE TABLE IF NOT EXISTS usuarios(
id INTEGER PRIMARY KEY AUTOINCREMENT,
nome TEXT,
senha TEXT
)
`);


console.log("Banco SQLite preparado!");

});
// ATUALIZA SERVIÇOS DA BARBEARIA
db.run("DELETE FROM servicos");
const servicos = [

[
"Corte e sobrancelha",
45,
"corte"
],

[
"Sobrancelha na gilete",
10,
"sg"
],

[
"Corte e barba",
55,
"cb"
],

[
"Corte barba e sobrancelha",
65,
"csb"
],

[
"Barba somente",
25,
"barba"
],

[
"Pezinho do cabelo",
12,
"pe"
],

[
"Luzes (a partir de 90 - valor a combinar)",
90,
"luzes"
]

];



const inserir = db.prepare(
"INSERT INTO servicos(nome,preco,imagem) VALUES(?,?,?)"
);



servicos.forEach(servico=>{


inserir.run(
servico[0],
servico[1],
servico[2]
);


});



inserir.finalize();


console.log("Serviços atualizados!");




// clientes

app.post("/clientes",(req,res)=>{

const {nome,telefone}=req.body;


if(!nome){
return res.status(400).json({
erro:"Nome obrigatório"
});
}


db.run(
"INSERT INTO clientes(nome,telefone) VALUES(?,?)",
[nome,telefone],

function(err){

if(err){
return res.status(500).json({
erro:err.message
});
}


res.json({
id:this.lastID,
nome,
telefone
});


});


});



app.get("/clientes",(req,res)=>{


db.all(
"SELECT * FROM clientes",
[],
(err,rows)=>{


if(err){
return res.status(500).json({
erro:err.message
});
}


res.json(rows);


});


});




// serviços

app.post("/servicos",(req,res)=>{

const {nome,preco}=req.body;


if(!nome || !preco){
return res.status(400).json({
erro:"Nome e preço obrigatórios"
});
}


db.run(
"INSERT INTO servicos(nome,preco) VALUES(?,?)",
[nome,preco],

function(err){

if(err){
return res.status(500).json({
erro:err.message
});
}


res.json({
id:this.lastID,
nome,
preco
});


});


});

app.get("/servicos",(req,res)=>{


db.all(
"SELECT * FROM servicos",
[],
(err,rows)=>{


if(err){
return res.status(500).json({
erro:err.message
});
}


res.json(rows);


});


});





// horários disponíveis

app.get("/horarios/:data",(req,res)=>{


const data=req.params.data;


const dia=new Date(data+"T00:00:00").getDay();


if(dia===0){
return res.json([]);
}



const horarios = [

"09:00",
"09:40",
"10:20",
"11:00",
"11:40",
"12:20",
"13:00",
"13:40",
"14:20",
"15:00",
"15:40",
"16:20",
"17:00",
"17:40",
"18:20",
"19:00",
"19:40"

];


db.all(
"SELECT horario FROM agendamentos WHERE data=?",
[data],

(err,ocupados)=>{


if(err){
return res.status(500).json({
erro:err.message
});
}


const lista=ocupados.map(item=>item.horario);



const resultado=horarios.map(horario=>({

horario,
ocupado:lista.includes(horario)

}));


res.json(resultado);


});


});


// buscar status fechado

// buscar status fechado
app.get("/configuracao",(req,res)=>{

db.get(
"SELECT fechado FROM configuracoes WHERE id=1",
[],
(err,row)=>{

if(err){
return res.status(500).json({
erro:err.message
});
}


if(!row){

return res.json({
fechado:false
});

}


res.json({
fechado: row.fechado === 1
});


});

});




// alterar status fechado
app.put("/configuracao",(req,res)=>{

const {fechado} = req.body;


if(typeof fechado !== "boolean"){

return res.status(400).json({
erro:"Valor inválido"
});

}


db.run(
`
UPDATE configuracoes
SET fechado=?
WHERE id=1
`,
[
fechado ? 1 : 0
],

(err)=>{


if(err){

console.log("Erro configuração:",err.message);

return res.status(500).json({
erro:err.message
});

}


res.json({
fechado
});


});


});

app.listen(PORT,()=>{

console.log(`Servidor rodando na porta ${PORT}`);

});