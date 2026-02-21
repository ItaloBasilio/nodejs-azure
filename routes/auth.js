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
function lerUsuarios() {
  // Se não existir, cria com admin padrão
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
          },
        ],
        null,
        2
      )
    );
  }

  return JSON.parse(fs.readFileSync(usuariosPath, "utf8"));
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

  const user = usuarios.find(
    (u) => u.usuario === usuario && String(u.senha) === String(senha)
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Credenciais inválidas",
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