// routes/categorias.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { authJwt } = require("../middlewares/authJwt");

const categoriasPath = path.join(__dirname, "../categorias.json");

/* ===============================
   HELPERS
================================= */
function garantirArquivo() {
  if (!fs.existsSync(categoriasPath)) {
    fs.writeFileSync(categoriasPath, JSON.stringify([], null, 2));
  }
}

function lerCategorias() {
  garantirArquivo();
  return JSON.parse(fs.readFileSync(categoriasPath, "utf8"));
}

function salvarCategorias(categorias) {
  fs.writeFileSync(categoriasPath, JSON.stringify(categorias, null, 2));
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

/**
 * Normaliza para comparação/duplicidade:
 * "Acesso e Permissões" -> "acesso-e-permissoes"
 */
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
 * Lista categorias
 * - admin: todas
 * - analista: somente ativas (segurança)
 *
 * Query opcional:
 *  ?ativas=1 => retorna apenas ativas (bom pro select)
 */
router.get("/", permitirRoles("admin", "analista"), (req, res) => {
  const role = req.usuario.role;
  const somenteAtivas = String(req.query.ativas || "") === "1";

  let categorias = lerCategorias();

  // analista sempre só ativas
  if (role === "analista") {
    categorias = categorias.filter((c) => c.ativa === true);
  } else if (role === "admin" && somenteAtivas) {
    categorias = categorias.filter((c) => c.ativa === true);
  }

  // ordena por grupo e nome
  categorias.sort((a, b) => {
    const g = (a.grupo || "").localeCompare(b.grupo || "", "pt-BR");
    if (g !== 0) return g;
    return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
  });

  return res.json(categorias);
});

/**
 * POST /
 * Cria categoria (admin)
 * body: { grupo, nome }
 * Ex: { grupo: "Acesso e Permissões", nome: "Excluir usuário" }
 */
router.post("/", somenteAdmin, (req, res) => {
  const { grupo, nome } = req.body;

  const grupoTrim = String(grupo || "").trim();
  const nomeTrim = String(nome || "").trim();

  if (grupoTrim.length < 2 || nomeTrim.length < 2) {
    return res.status(400).json({ error: "Informe Grupo e Nome da categoria" });
  }

  const categorias = lerCategorias();

  const key = `${slugify(grupoTrim)}::${slugify(nomeTrim)}`;
  const existe = categorias.find((c) => c.key === key);

  if (existe) {
    return res.status(400).json({ error: "Essa categoria já existe nesse grupo" });
  }

  const nova = {
    id: Date.now().toString(),
    grupo: grupoTrim,
    nome: nomeTrim,
    key,
    ativa: true,
    criadoEm: new Date().toISOString(),
  };

  categorias.push(nova);
  salvarCategorias(categorias);

  return res.status(201).json({ message: "Categoria criada com sucesso", categoria: nova });
});

/**
 * PUT /:id
 * Atualiza categoria (admin)
 * body: { grupo?, nome?, ativa? }
 */
router.put("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { grupo, nome, ativa } = req.body;

  const categorias = lerCategorias();
  const idx = categorias.findIndex((c) => String(c.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Categoria não encontrada" });

  const atual = categorias[idx];

  if (typeof grupo === "string") {
    const grupoTrim = grupo.trim();
    if (grupoTrim.length < 2) return res.status(400).json({ error: "Grupo inválido" });
    atual.grupo = grupoTrim;
  }

  if (typeof nome === "string") {
    const nomeTrim = nome.trim();
    if (nomeTrim.length < 2) return res.status(400).json({ error: "Nome inválido" });
    atual.nome = nomeTrim;
  }

  if (typeof ativa === "boolean") {
    atual.ativa = ativa;
  }

  // recalcula key e checa duplicidade
  const newKey = `${slugify(atual.grupo)}::${slugify(atual.nome)}`;
  const existeOutro = categorias.find(
    (c) => String(c.id) !== String(id) && c.key === newKey
  );
  if (existeOutro) {
    return res.status(400).json({ error: "Já existe outra categoria igual nesse grupo" });
  }

  atual.key = newKey;
  atual.atualizadoEm = new Date().toISOString();

  categorias[idx] = atual;
  salvarCategorias(categorias);

  return res.json({ message: "Categoria atualizada com sucesso", categoria: atual });
});

/**
 * DELETE /:id
 * Remove categoria (admin)
 */
router.delete("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;

  let categorias = lerCategorias();
  const antes = categorias.length;

  categorias = categorias.filter((c) => String(c.id) !== String(id));
  if (categorias.length === antes) {
    return res.status(404).json({ error: "Categoria não encontrada" });
  }

  salvarCategorias(categorias);
  return res.json({ message: "Categoria removida com sucesso" });
});

module.exports = router;