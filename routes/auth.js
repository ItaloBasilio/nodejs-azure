var express = require('express');
var router = express.Router();

router.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    if (usuario === "admin" && senha === "1234") {
        req.session.logado = true;
        return res.json({ success: true });
    }

    res.status(401).json({ success: false });
});

router.get('/check', (req, res) => {
    if (req.session.logado) {
        res.json({ logado: true });
    } else {
        res.status(401).json({ logado: false });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ logout: true });
});

module.exports = router;