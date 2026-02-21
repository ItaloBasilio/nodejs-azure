const jwt = require("jsonwebtoken");

// 🔐 Em produção, use process.env.JWT_SECRET
const JWT_SECRET = "SERVICEDESK_JWT_SECRET_2026";

/**
 * Middleware de autenticação JWT
 * - Lê Authorization: Bearer TOKEN
 * - Valida token
 * - Injeta req.usuario { id, nome, role }
 */
function authJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Token não informado",
      code: "NO_TOKEN",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Formato do token inválido",
      code: "INVALID_TOKEN_FORMAT",
    });
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // decoded contém: { id, nome, role, iat, exp }
    if (!decoded?.id || !decoded?.nome || !decoded?.role) {
      return res.status(401).json({
        error: "Token inválido",
        code: "INVALID_TOKEN_PAYLOAD",
      });
    }

    // 🔥 Injeta usuário no request
    req.usuario = {
      id: decoded.id,
      nome: decoded.nome,
      role: decoded.role,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      error: "Token inválido ou expirado",
      code: "TOKEN_EXPIRED_OR_INVALID",
    });
  }
}

module.exports = {
  authJwt,
  JWT_SECRET,
};