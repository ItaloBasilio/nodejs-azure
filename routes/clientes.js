// routes/clientes.js
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { authJwt } = require("../middlewares/authJwt");

const clientesPath = path.join(__dirname, "../clientes.json");

/* ===============================
   HELPERS
================================= */
function garantirArquivo() {
  if (!fs.existsSync(clientesPath)) {
    fs.writeFileSync(clientesPath, JSON.stringify([], null, 2));
  }
}

function lerClientes() {
  garantirArquivo();
  return JSON.parse(fs.readFileSync(clientesPath, "utf8"));
}

function salvarClientes(clientes) {
  fs.writeFileSync(clientesPath, JSON.stringify(clientes, null, 2));
}

function somenteAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== "admin") {
    return res.status(403).json({
      error: "Acesso permitido apenas para administradores",
    });
  }
  next();
}

// Permite admin e analista
function permitirRoles(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.role)) {
      return res.status(403).json({ error: "Acesso não autorizado" });
    }
    next();
  };
}

/* ===============================
   ROTAS (PROTEGIDAS POR JWT)
================================= */
router.use(authJwt);

/**
 * GET /
 * Lista clientes
 * - admin: lista todos
 * - analista: lista apenas ativos (para preencher select)
 *
 * Query opcional:
 *   ?ativos=1  => retorna apenas ativos (bom pro select)
 */
router.get("/", permitirRoles("admin", "analista"), (req, res) => {
  const role = req.usuario.role;
  const somenteAtivos = String(req.query.ativos || "") === "1";

  let clientes = lerClientes();

  // Analista SEMPRE enxerga apenas ativos (segurança)
  if (role === "analista") {
    clientes = clientes.filter((c) => c.ativo === true);
  } else if (role === "admin" && somenteAtivos) {
    // Admin pode pedir só ativos também (útil no front)
    clientes = clientes.filter((c) => c.ativo === true);
  }

  clientes.sort((a, b) => Number(b.id) - Number(a.id));
  return res.json(clientes);
});

/**
 * POST /
 * Cria cliente (admin)
 * body: { nome, cnpj }
 */
router.post("/", somenteAdmin, (req, res) => {
  const { nome, cnpj } = req.body;

  if (!nome || !cnpj) {
    return res.status(400).json({ error: "Informe nome e CNPJ" });
  }

  const nomeTrim = String(nome).trim();
  const cnpjDigits = String(cnpj).replace(/\D/g, "");

  if (nomeTrim.length < 2) {
    return res.status(400).json({ error: "Nome do cliente inválido" });
  }

  if (cnpjDigits.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido (precisa ter 14 dígitos)" });
  }

  const clientes = lerClientes();

  const existeCnpj = clientes.find((c) => String(c.cnpjDigits) === cnpjDigits);
  if (existeCnpj) {
    return res.status(400).json({ error: "Já existe um cliente com esse CNPJ" });
  }

  const novoCliente = {
    id: Date.now().toString(),
    nome: nomeTrim,
    cnpj: String(cnpj).trim(),
    cnpjDigits,
    ativo: true,
    criadoEm: new Date().toISOString(),
  };

  clientes.push(novoCliente);
  salvarClientes(clientes);

  return res.status(201).json({
    message: "Cliente criado com sucesso",
    cliente: novoCliente,
  });
});

/**
 * PUT /:id
 * Atualiza cliente (admin)
 * body: { nome?, cnpj?, ativo? }
 */
router.put("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { nome, cnpj, ativo } = req.body;

  const clientes = lerClientes();
  const idx = clientes.findIndex((c) => String(c.id) === String(id));

  if (idx === -1) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  const atual = clientes[idx];

  if (typeof nome === "string") {
    const nomeTrim = nome.trim();
    if (nomeTrim.length < 2) {
      return res.status(400).json({ error: "Nome do cliente inválido" });
    }
    atual.nome = nomeTrim;
  }

  if (typeof cnpj === "string") {
    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      return res.status(400).json({ error: "CNPJ inválido (precisa ter 14 dígitos)" });
    }

    const existeOutro = clientes.find(
      (c) => String(c.id) !== String(id) && String(c.cnpjDigits) === cnpjDigits
    );
    if (existeOutro) {
      return res.status(400).json({ error: "Já existe outro cliente com esse CNPJ" });
    }

    atual.cnpj = cnpj.trim();
    atual.cnpjDigits = cnpjDigits;
  }

  if (typeof ativo === "boolean") {
    atual.ativo = ativo;
  }

  atual.atualizadoEm = new Date().toISOString();

  clientes[idx] = atual;
  salvarClientes(clientes);

  return res.json({ message: "Cliente atualizado com sucesso", cliente: atual });
});

/**
 * DELETE /:id
 * Deleta cliente (admin)
 */
router.delete("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;

  let clientes = lerClientes();
  const antes = clientes.length;

  clientes = clientes.filter((c) => String(c.id) !== String(id));

  if (clientes.length === antes) {
    return res.status(404).json({ error: "Cliente não encontrado" });
  }

  salvarClientes(clientes);
  return res.json({ message: "Cliente deletado com sucesso" });
});

module.exports = router;