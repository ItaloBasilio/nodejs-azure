var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const { JWT_SECRET, authJwt } = require("../middlewares/authJwt");

// 🔐 Base de usuários mock (depois você troca por banco)
const usuarios = [
  { id: 1, nome: "Admin", usuario: "admin", senha: "admin", role: "admin" },
  { id: 2, nome: "João", usuario: "joao", senha: "1234", role: "analista" },
];

// LOGIN -> devolve token
router.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (!usuario || !senha) {
    return res.status(400).json({
      success: false,
      message: "Usuário e senha são obrigatórios",
    });
  }

  const user = usuarios.find((u) => u.usuario === usuario && u.senha === senha);

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

// CHECK -> valida token e devolve usuário
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

// LOGOUT -> em JWT não existe "deslogar" no servidor (token expira).
// Mantemos a rota por compatibilidade.
router.post("/logout", (req, res) => {
  return res.json({ logout: true });
});

module.exports = router;