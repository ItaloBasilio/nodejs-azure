var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");

/* ===============================
   ROTAS PÚBLICAS
================================= */

router.get("/login", function (req, res) {
  res.render("login");
});

/* ===============================
   ROTAS (JWT VALIDADO NO FRONT)
================================= */

router.get("/", function (req, res) {
  res.render("index");
});

router.get("/chamados", function (req, res) {
  res.render("chamados");
});

// ✅ NOVA ROTA: MEUS CHAMADOS (visível para admin e analista)
router.get("/meus-chamados", function (req, res) {
  res.render("meus-chamados");
});

router.get("/novo-chamado", function (req, res) {
  res.render("novo-chamado");
});

router.get("/usuarios", function (req, res) {
  res.render("usuarios");
});

/* ===============================
   ✅ GESTÃO DE CLIENTES
================================= */
router.get("/clientes", function (req, res) {
  res.render("clientes");
});

/* ===============================
   ✅ GESTÃO DE CATEGORIAS
================================= */
router.get("/gestao-categorias", function (req, res) {
  res.render("gestaoCategorias");
});

/* ===============================
   ✅ NOVA ROTA: GESTÃO DE GRUPOS
================================= */
router.get("/gestao-grupos", function (req, res) {
  res.render("gestaoGrupos");
});

/* ===============================
   ✅ NOVA ROTA: GESTÃO DE Logs
================================= */

router.get("/gestao-logs-login", function (req, res) {
  res.render("gestao-logs-login");
});

router.get("/gestao-bloqueios-login", function (req, res) {
  res.render("gestao-bloqueios-login");
});

/* ===============================
   DETALHE DO CHAMADO
================================= */

router.get("/chamados/:id", function (req, res) {
  const id = req.params.id;

  try {
    const filePath = path.join(__dirname, "../chamados.json");
    const chamados = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const chamadoEncontrado = chamados.find((c) => String(c.id) === String(id));

    if (!chamadoEncontrado) {
      return res.status(404).send("Chamado não encontrado.");
    }

    if (!chamadoEncontrado.interacoes) chamadoEncontrado.interacoes = [];
    if (!chamadoEncontrado.anexos) chamadoEncontrado.anexos = [];
    if (!chamadoEncontrado.dataCriacao)
      chamadoEncontrado.dataCriacao = new Date().toISOString();

    res.render("detalhe-chamado", {
      chamado: chamadoEncontrado,
    });
  } catch (error) {
    console.error("Erro ao carregar chamado:", error);
    res.status(500).send("Erro interno ao carregar chamado.");
  }
});

module.exports = router;