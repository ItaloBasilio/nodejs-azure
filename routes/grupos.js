// routes/grupos.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { authJwt } = require("../middlewares/authJwt");

const gruposPath = path.join(__dirname, "../gestaoGrupos.json");

/* ===============================
   HELPERS
================================= */
function garantirArquivo() {
  if (!fs.existsSync(gruposPath)) {
    fs.writeFileSync(gruposPath, JSON.stringify([], null, 2));
  }
}

function lerGrupos() {
  garantirArquivo();
  return JSON.parse(fs.readFileSync(gruposPath, "utf8"));
}

function salvarGrupos(grupos) {
  fs.writeFileSync(gruposPath, JSON.stringify(grupos, null, 2));
}

function somenteAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== "admin") {
    return res.status(403).json({ error: "Acesso permitido apenas para administradores" });
  }
  next();
}

function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.role)) {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    next();
  };
}

function slugify(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ===============================
   ROTAS (JWT)
================================= */
router.use(authJwt);

/**
 * GET /
 * Lista grupos
 * - admin: todos
 * - analista: somente ativos
 *
 * Query opcional:
 *   ?ativos=1 => retorna apenas ativos
 */
router.get("/", permitirRoles("admin", "analista"), (req, res) => {
  const role = req.usuario.role;
  const somenteAtivos = String(req.query.ativos || "") === "1";

  let grupos = lerGrupos();

  if (role === "analista") {
    grupos = grupos.filter((g) => g.ativo === true);
  } else if (role === "admin" && somenteAtivos) {
    grupos = grupos.filter((g) => g.ativo === true);
  }

  grupos.sort((a, b) => (a.nome || "").localeCompare((b.nome || ""), "pt-BR"));
  return res.json(grupos);
});

/**
 * POST /
 * Cria grupo (admin)
 * body: { nome }
 */
router.post("/", somenteAdmin, (req, res) => {
  const { nome } = req.body;

  const nomeTrim = String(nome || "").trim();
  if (nomeTrim.length < 2) {
    return res.status(400).json({ error: "Informe o nome do grupo" });
  }

  const grupos = lerGrupos();
  const key = slugify(nomeTrim);

  const existe = grupos.find((g) => g.key === key);
  if (existe) {
    return res.status(400).json({ error: "Esse grupo já existe" });
  }

  const novo = {
    id: Date.now().toString(),
    nome: nomeTrim,
    key,
    ativo: true,
    criadoEm: new Date().toISOString(),
  };

  grupos.push(novo);
  salvarGrupos(grupos);

  return res.status(201).json({ message: "Grupo criado com sucesso", grupo: novo });
});

/**
 * PUT /:id
 * Atualiza grupo (admin)
 * body: { nome?, ativo? }
 */
router.put("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;

  const grupos = lerGrupos();
  const idx = grupos.findIndex((g) => String(g.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Grupo não encontrado" });

  const atual = grupos[idx];

  if (typeof nome === "string") {
    const nomeTrim = nome.trim();
    if (nomeTrim.length < 2) return res.status(400).json({ error: "Nome do grupo inválido" });

    const newKey = slugify(nomeTrim);
    const existeOutro = grupos.find(
      (g) => String(g.id) !== String(id) && g.key === newKey
    );
    if (existeOutro) {
      return res.status(400).json({ error: "Já existe outro grupo com esse nome" });
    }

    atual.nome = nomeTrim;
    atual.key = newKey;
  }

  if (typeof ativo === "boolean") {
    atual.ativo = ativo;
  }

  atual.atualizadoEm = new Date().toISOString();
  grupos[idx] = atual;

  salvarGrupos(grupos);
  return res.json({ message: "Grupo atualizado com sucesso", grupo: atual });
});

/**
 * DELETE /:id
 * Deleta grupo (admin)
 */
router.delete("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;

  let grupos = lerGrupos();
  const antes = grupos.length;

  grupos = grupos.filter((g) => String(g.id) !== String(id));
  if (grupos.length === antes) return res.status(404).json({ error: "Grupo não encontrado" });

  salvarGrupos(grupos);
  return res.json({ message: "Grupo removido com sucesso" });
});

module.exports = router;