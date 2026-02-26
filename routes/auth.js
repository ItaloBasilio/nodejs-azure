// routes/auth.js

var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { JWT_SECRET, authJwt } = require("../middlewares/authJwt");

// Arquivo onde ficam os usuários
const usuariosPath = path.join(__dirname, "../usuarios.json");

/* ===============================
   HELPERS
================================= */
function garantirArquivoUsuarios() {
  if (!fs.existsSync(usuariosPath)) {
    fs.writeFileSync(
      usuariosPath,
      JSON.stringify(
        [
          {
            id: 1,
            nome: "Admin",
            usuario: "admin",
            senha: "admin",
            role: "admin",
            ativo: true,
            criadoEm: new Date().toISOString(),
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

  const normalizados = (usuarios || []).map((u) => {
    const nu = { ...u };

    // garante ativo
    if (typeof nu.ativo !== "boolean") {
      nu.ativo = true;
      mudou = true;
    }

    // garante role
    if (!nu.role) {
      nu.role = "analista";
      mudou = true;
    }

    return nu;
  });

  return { normalizados, mudou };
}

function lerUsuarios() {
  garantirArquivoUsuarios();

  const usuarios = JSON.parse(fs.readFileSync(usuariosPath, "utf8")) || [];
  const { normalizados, mudou } = normalizarUsuarios(usuarios);

  // se teve ajuste (ativo faltando etc), salva de volta
  if (mudou) {
    fs.writeFileSync(usuariosPath, JSON.stringify(normalizados, null, 2));
  }

  return normalizados;
}

/* ===============================
   LOGIN -> devolve token
================================= */
router.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({
      success: false,
      message: "Usuário e senha são obrigatórios",
    });
  }

  const usuarios = lerUsuarios();

  // login case-insensitive
  const usuarioInput = String(usuario).trim().toLowerCase();
  const senhaInput = String(senha);

  const user = usuarios.find(
    (u) =>
      String(u.usuario).trim().toLowerCase() === usuarioInput &&
      String(u.senha) === senhaInput
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Credenciais inválidas",
    });
  }

  // ✅ BLOQUEIA USUÁRIO INATIVO
  if (user.ativo === false) {
    return res.status(403).json({
      success: false,
      message: "Usuário desativado. Procure o administrador.",
    });
  }

  const token = jwt.sign(
    { id: user.id, nome: user.nome, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    success: true,
    token,
    usuario: {
      id: user.id,
      nome: user.nome,
      role: user.role,
      ativo: user.ativo === true,
    },
  });
});

/* ===============================
   CHECK -> valida token e devolve usuário
================================= */
router.get("/check", authJwt, (req, res) => {
  return res.json({
    logado: true,
    usuario: {
      id: req.usuario.id,
      nome: req.usuario.nome,
      role: req.usuario.role,
      ativo: req.usuario.ativo === true,
    },
  });
});

/* ===============================
   LOGOUT -> em JWT é no client
================================= */
router.post("/logout", (req, res) => {
  return res.json({ logout: true });
});

module.exports = router;