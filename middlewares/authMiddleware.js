const jwt = require("jsonwebtoken");

const SECRET = "SEU_SEGREDO_JWT";

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, SECRET);

        req.usuario = decoded;
        // teremos: id, nome, role

        next();
    } catch (err) {
        return res.status(401).json({ error: "Token inválido" });
    }
}

module.exports = verificarToken;