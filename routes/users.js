// routes/users.js

var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");
const { authJwt } = require("../middlewares/authJwt");

const usuariosPath = path.join(__dirname, "../usuarios.json");

/* ===============================
   HELPERS
================================= */

function lerUsuarios() {
  if (!fs.existsSync(usuariosPath)) {
    // cria arquivo inicial com admin padrão
    fs.writeFileSync(
      usuariosPath,
      JSON.stringify(
        [
          {
            id: 1,
            nome: "Admin",
            usuario: "admin",
            senha: "1234",
            role: "admin",
          },
        ],
        null,
        2
      )
    );
  }

  return JSON.parse(fs.readFileSync(usuariosPath, "utf8"));
}

function salvarUsuarios(usuarios) {
  fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
}

/* ===============================
   MIDDLEWARE: SOMENTE ADMIN
================================= */
function somenteAdmin(req, res, next) {
  if (!req.usuario || req.usuario.role !== "admin") {
    return res.status(403).json({
      error: "Acesso permitido apenas para administradores",
    });
  }
  next();
}

/* ===============================
   ROTAS (PROTEGIDAS POR JWT)
================================= */

// 🔐 Todas exigem token válido
router.use(authJwt);

/**
 * GET /
 * Lista usuários (admin apenas)
 * (NUNCA devolver senha)
 */
router.get("/", somenteAdmin, (req, res) => {
  const usuarios = lerUsuarios();

  const usuariosSafe = usuarios.map((u) => ({
    id: u.id,
    nome: u.nome,
    usuario: u.usuario,
    role: u.role,
  }));

  res.json(usuariosSafe);
});

/**
 * POST /
 * Criar novo usuário (admin apenas)
 */
router.post("/", somenteAdmin, (req, res) => {
  const { nome, usuario, senha, role } = req.body;

  if (!nome || !usuario || !senha || !role) {
    return res.status(400).json({
      error: "Todos os campos são obrigatórios",
    });
  }

  const roleOk = role === "admin" || role === "analista";
  if (!roleOk) {
    return res.status(400).json({
      error: "Role inválida. Use: admin ou analista",
    });
  }

  const usuariosDb = lerUsuarios();

  const existe = usuariosDb.find(
    (u) => String(u.usuario).toLowerCase() === String(usuario).toLowerCase()
  );
  if (existe) {
    return res.status(400).json({
      error: "Usuário já existe",
    });
  }

  const novoUsuario = {
    id: Date.now(),
    nome: String(nome).trim(),
    usuario: String(usuario).trim(),
    senha: String(senha), // futuramente: hash
    role,
  };

  usuariosDb.push(novoUsuario);
  salvarUsuarios(usuariosDb);

  res.status(201).json({
    message: "Usuário criado com sucesso",
    usuario: {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
      usuario: novoUsuario.usuario,
      role: novoUsuario.role,
    },
  });
});

/**
 * PUT /:id/senha
 * Alterar senha (admin apenas)
 */
router.put("/:id/senha", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { senha } = req.body;

  if (!senha) {
    return res.status(400).json({ error: "Informe a nova senha" });
  }

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));

  if (idx === -1) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  usuariosDb[idx].senha = String(senha);
  salvarUsuarios(usuariosDb);

  return res.json({ message: "Senha alterada com sucesso" });
});

/**
 * PUT /:id/role
 * Alterar role (admin apenas)
 * Body: { "role": "admin" | "analista" }
 */
router.put("/:id/role", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({ error: "Informe a nova role" });
  }

  const roleOk = role === "admin" || role === "analista";
  if (!roleOk) {
    return res.status(400).json({
      error: "Role inválida. Use: admin ou analista",
    });
  }

  // ❗ Segurança: impede admin de mudar a própria role
  if (String(id) === String(req.usuario.id)) {
    return res.status(400).json({
      error: "Não é permitido alterar a própria role",
    });
  }

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));

  if (idx === -1) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  usuariosDb[idx].role = role;
  salvarUsuarios(usuariosDb);

  return res.json({
    message: "Role alterada com sucesso",
    usuario: {
      id: usuariosDb[idx].id,
      nome: usuariosDb[idx].nome,
      usuario: usuariosDb[idx].usuario,
      role: usuariosDb[idx].role,
    },
  });
});

/**
 * DELETE /:id
 * Deletar usuário (admin apenas)
 */
router.delete("/:id", somenteAdmin, (req, res) => {
  const { id } = req.params;

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));

  if (idx === -1) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  // ❗ Segurança: impede admin de se deletar
  if (String(usuariosDb[idx].id) === String(req.usuario.id)) {
    return res.status(400).json({
      error: "Não é permitido deletar o próprio usuário",
    });
  }

  const removido = usuariosDb.splice(idx, 1)[0];
  salvarUsuarios(usuariosDb);

  return res.json({
    message: "Usuário removido com sucesso",
    usuario: {
      id: removido.id,
      nome: removido.nome,
      usuario: removido.usuario,
      role: removido.role,
    },
  });
});

module.exports = router;