// routes/users.js

var express = require("express");
var router = express.Router();
const fs = require("fs");
const path = require("path");
const { authJwt } = require("../middlewares/authJwt");

const usuariosPath = path.join(__dirname, "../usuarios.json");

// ✅ fonte de verdade do lockout
const loginAttemptsPath = path.join(__dirname, "../loginAttempts.json");

/* ===============================
   HELPERS
================================= */

function garantirArquivoInicial() {
  if (!fs.existsSync(usuariosPath)) {
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
            ativo: true,
          },
        ],
        null,
        2
      )
    );
  }
}

function normalizarUsuarios(usuarios) {
  let mudou = false;

  for (const u of usuarios) {
    if (typeof u.ativo !== "boolean") {
      u.ativo = true;
      mudou = true;
    }
  }

  return { usuarios, mudou };
}

function lerUsuarios() {
  garantirArquivoInicial();

  const usuarios = JSON.parse(fs.readFileSync(usuariosPath, "utf8"));
  const { usuarios: normalizados, mudou } = normalizarUsuarios(usuarios);

  if (mudou) {
    fs.writeFileSync(usuariosPath, JSON.stringify(normalizados, null, 2));
  }

  return normalizados;
}

function salvarUsuarios(usuarios) {
  fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
}

/* ===== attempts ===== */

function garantirAttemptsArquivo() {
  if (!fs.existsSync(loginAttemptsPath)) {
    fs.writeFileSync(loginAttemptsPath, JSON.stringify([], null, 2));
  }
}

function lerAttempts() {
  garantirAttemptsArquivo();
  return JSON.parse(fs.readFileSync(loginAttemptsPath, "utf8"));
}

function salvarAttempts(attempts) {
  fs.writeFileSync(loginAttemptsPath, JSON.stringify(attempts, null, 2));
}

function getAttemptsEntry(attempts, userKey) {
  return attempts.find(
    (a) => String(a.usuario).toLowerCase() === String(userKey).toLowerCase()
  );
}

function estaBloqueadoPorAttempts(entry) {
  if (!entry?.blockedUntil) return false;
  const t = new Date(entry.blockedUntil).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function resetarAttempts(entry) {
  entry.failCount = 0;
  entry.firstFailAt = null;
  entry.lastFailAt = null;
  entry.blockedUntil = null;
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

router.use(authJwt);

/**
 * GET /
 * Lista usuários (admin apenas)
 * (NUNCA devolver senha)
 * ✅ Agora devolve status real do lockout via loginAttempts.json
 */
router.get("/", somenteAdmin, (req, res) => {
  const usuarios = lerUsuarios();
  const attempts = lerAttempts();

  const usuariosSafe = usuarios.map((u) => {
    const userKey = String(u.usuario || "").toLowerCase();
    const entry = getAttemptsEntry(attempts, userKey);

    const bloqueado = estaBloqueadoPorAttempts(entry);

    return {
      id: u.id,
      nome: u.nome,
      usuario: u.usuario,
      role: u.role,
      ativo: u.ativo,

      // ✅ lockout real
      bloqueado,
      bloqueadoAte: entry?.blockedUntil ?? null,
      tentativasInvalidas: entry?.failCount ?? 0,
    };
  });

  res.json(usuariosSafe);
});

/**
 * POST /
 * Criar novo usuário (admin apenas)
 */
router.post("/", somenteAdmin, (req, res) => {
  const { nome, usuario, senha, role } = req.body;

  if (!nome || !usuario || !senha || !role) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  const roleOk = role === "admin" || role === "analista";
  if (!roleOk) {
    return res.status(400).json({ error: "Role inválida. Use: admin ou analista" });
  }

  const usuariosDb = lerUsuarios();

  const existe = usuariosDb.find(
    (u) => String(u.usuario).toLowerCase() === String(usuario).toLowerCase()
  );
  if (existe) {
    return res.status(400).json({ error: "Usuário já existe" });
  }

  const novoUsuario = {
    id: Date.now(),
    nome: String(nome).trim(),
    usuario: String(usuario).trim(),
    senha: String(senha),
    role,
    ativo: true,
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
      ativo: novoUsuario.ativo,
      bloqueado: false,
      bloqueadoAte: null,
      tentativasInvalidas: 0,
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

  if (!senha) return res.status(400).json({ error: "Informe a nova senha" });

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado" });

  usuariosDb[idx].senha = String(senha);
  salvarUsuarios(usuariosDb);

  return res.json({ message: "Senha alterada com sucesso" });
});

/**
 * PUT /:id/role
 * Alterar role (admin apenas)
 */
router.put("/:id/role", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role) return res.status(400).json({ error: "Informe a nova role" });

  const roleOk = role === "admin" || role === "analista";
  if (!roleOk) {
    return res.status(400).json({ error: "Role inválida. Use: admin ou analista" });
  }

  if (String(id) === String(req.usuario.id)) {
    return res.status(400).json({ error: "Não é permitido alterar a própria role" });
  }

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado" });

  usuariosDb[idx].role = role;
  salvarUsuarios(usuariosDb);

  return res.json({
    message: "Role alterada com sucesso",
  });
});

/**
 * ✅ PUT /:id/ativo
 * Ativar/Inativar usuário (admin apenas)
 */
router.put("/:id/ativo", somenteAdmin, (req, res) => {
  const { id } = req.params;
  const { ativo } = req.body;

  if (typeof ativo !== "boolean") {
    return res.status(400).json({ error: "Informe ativo como boolean (true/false)" });
  }

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado" });

  if (String(usuariosDb[idx].id) === String(req.usuario.id) && ativo === false) {
    return res.status(400).json({ error: "Não é permitido inativar o próprio usuário" });
  }

  usuariosDb[idx].ativo = ativo;
  salvarUsuarios(usuariosDb);

  return res.json({
    message: `Usuário ${ativo ? "ativado" : "inativado"} com sucesso`,
  });
});

/**
 * ✅ PUT /:id/desbloquear
 * Admin desbloqueia usuário ANTES do tempo
 * ✅ Agora limpa a fonte de verdade: loginAttempts.json
 */
router.put("/:id/desbloquear", somenteAdmin, (req, res) => {
  const { id } = req.params;

  const usuariosDb = lerUsuarios();
  const idx = usuariosDb.findIndex((u) => String(u.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado" });

  const username = String(usuariosDb[idx].usuario || "").trim();
  const userKey = username.toLowerCase();

  const attempts = lerAttempts();
  const entry = getAttemptsEntry(attempts, userKey);

  if (entry) {
    resetarAttempts(entry);
    salvarAttempts(attempts);
  }

  return res.json({
    message: "Usuário desbloqueado com sucesso",
    usuario: {
      id: usuariosDb[idx].id,
      nome: usuariosDb[idx].nome,
      usuario: usuariosDb[idx].usuario,
      role: usuariosDb[idx].role,
      ativo: usuariosDb[idx].ativo,
      bloqueado: false,
      bloqueadoAte: null,
      tentativasInvalidas: 0,
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
  if (idx === -1) return res.status(404).json({ error: "Usuário não encontrado" });

  if (String(usuariosDb[idx].id) === String(req.usuario.id)) {
    return res.status(400).json({ error: "Não é permitido deletar o próprio usuário" });
  }

  const removido = usuariosDb.splice(idx, 1)[0];
  salvarUsuarios(usuariosDb);

  // remove attempts também
  const attempts = lerAttempts();
  const userKey = String(removido.usuario || "").toLowerCase();
  const filtrado = attempts.filter(
    (a) => String(a.usuario).toLowerCase() !== userKey
  );
  salvarAttempts(filtrado);

  return res.json({
    message: "Usuário removido com sucesso",
    usuario: {
      id: removido.id,
      nome: removido.nome,
      usuario: removido.usuario,
      role: removido.role,
      ativo: removido.ativo,
    },
  });
});

module.exports = router;