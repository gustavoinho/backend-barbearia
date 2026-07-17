const express = require("express");
const router = express.Router();

const db = require("../database/database");


// LISTAR AGENDAMENTOS
router.get("/", (req,res)=>{

  db.all(
    "SELECT * FROM agendamentos ORDER BY data, horario",
    [],
    (err,rows)=>{

      if(err){
        return res.status(500).json({
          erro:err.message
        });
      }

      res.json(rows);

    }
  );

});




// CRIAR AGENDAMENTO
router.post("/",(req,res)=>{


  const {
    cliente,
    servico,
    data,
    horario,
    pagamento,
    total
  } = req.body;



  if(!cliente || !servico || !data || !horario){

    return res.status(400).json({
      erro:"Preencha todos os campos"
    });

  }



  // verifica se a barbearia está fechada

  db.get(
    "SELECT fechado FROM configuracoes WHERE id=1",
    [],
    (err,config)=>{


      if(err){

        return res.status(500).json({
          erro:err.message
        });

      }



      if(config && config.fechado === 1){

        return res.status(400).json({
          erro:"Estamos fechados hoje!"
        });

      }



      // bloqueia domingo pelo backend

      const dia = new Date(data+"T00:00:00").getDay();


      if(dia === 0){

        return res.status(400).json({
          erro:"Domingo não funciona"
        });

      }




      // verifica horário ocupado

      db.get(
        "SELECT * FROM agendamentos WHERE data=? AND horario=?",
        [data,horario],

        (err,existe)=>{


          if(err){

            return res.status(500).json({
              erro:err.message
            });

          }



          if(existe){

            return res.status(400).json({
              erro:"Horário ocupado"
            });

          }





          db.run(
            `
            INSERT INTO agendamentos
            (cliente,servico,data,horario,status,pagamento,total)
            VALUES(?,?,?,?,?,?,?)
            `,
            [
              cliente,
              servico,
              data,
              horario,
              "pendente",
              pagamento,
              total
            ],


            function(err){


              if(err){

                return res.status(500).json({
                  erro:err.message
                });

              }



              res.json({

                id:this.lastID,
                mensagem:"Agendamento criado!"

              });


            }


          );


        }


      );


    }

  );


});





// CONFIRMAR OU CANCELAR = REMOVER AGENDAMENTO
// libera automaticamente o horário

router.delete("/:id",(req,res)=>{

  const id = req.params.id;


  db.get(
    "SELECT cliente FROM agendamentos WHERE id=?",
    [id],

    (err,agendamento)=>{


      if(err){

        return res.status(500).json({
          erro:err.message
        });

      }


      if(!agendamento){

        return res.status(404).json({
          erro:"Agendamento não encontrado"
        });

      }



      db.run(
        "DELETE FROM agendamentos WHERE id=?",
        [id],

        (err)=>{


          if(err){

            return res.status(500).json({
              erro:err.message
            });

          }



          db.run(
            "DELETE FROM clientes WHERE nome=?",
            [agendamento.cliente]
          );



          res.json({

            mensagem:"Agendamento removido e horário liberado"

          });


        }

      );


    }

  );


});
module.exports = router;