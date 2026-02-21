const jwt = require("jsonwebtoken");

// Em produção, use process.env.JWT_SECRET
const JWT_SECRET = "SERVICEDESK_JWT_SECRET_2026";

function authJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não informado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // decoded: { id, nome, role, iat, exp }
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

module.exports = { authJwt, JWT_SECRET };