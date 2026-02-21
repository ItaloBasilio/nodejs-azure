var express = require('express');
var router = express.Router();

// 🔐 Base de usuários mock (futuramente banco de dados)
const usuarios = [
    { id: 1, nome: "Admin", usuario: "admin", senha: "1234", role: "admin" },
    { id: 2, nome: "João", usuario: "joao", senha: "1234", role: "analista" },
    { id: 3, nome: "Vinicius Santos", usuario: "vinicius", senha: "1234", role: "admin" }
];

// =============================
// LOGIN
// =============================
router.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
        return res.status(400).json({
            success: false,
            message: "Usuário e senha são obrigatórios"
        });
    }

    const user = usuarios.find(u => u.usuario === usuario && u.senha === senha);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Credenciais inválidas"
        });
    }

    // cria sessão
    req.session.logado = true;
    req.session.usuario = {
        id: user.id,
        nome: user.nome,
        role: user.role
    };

    return res.json({
        success: true,
        usuario: {
            id: user.id,
            nome: user.nome,
            role: user.role
        }
    });
});

// =============================
// VERIFICAR SESSÃO
// =============================
router.get('/check', (req, res) => {
    if (req.session && req.session.logado && req.session.usuario) {
        return res.json({
            logado: true,
            usuario: req.session.usuario
        });
    }

    return res.status(401).json({
        logado: false,
        message: "Não autenticado"
    });
});

// =============================
// LOGOUT
// =============================
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({
                logout: false,
                message: "Erro ao encerrar sessão"
            });
        }

        res.clearCookie('connect.sid');

        return res.json({
            logout: true,
            message: "Logout realizado com sucesso"
        });
    });
});

module.exports = router;