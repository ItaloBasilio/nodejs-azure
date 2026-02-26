// routes/auth.js

var express = require("express");
var router = express.Router();
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { JWT_SECRET, authJwt } = require("../middlewares/authJwt");

// Arquivo onde ficam os usuários
const usuariosPath = path.join(__dirname, "../usuarios.json");

// ✅ Arquivo de log de tentativas de login
const loginLogsPath = path.join(__dirname, "../loginLogs.json");

// ✅ Arquivo de controle de bloqueio por tentativas inválidas
const loginAttemptsPath = path.join(__dirname, "../loginAttempts.json");

// ✅ Config do bloqueio
const MAX_TENTATIVAS = 5;      // X tentativas inválidas
const JANELA_MINUTOS = 15;     // dentro de Y minutos
const BLOQUEIO_MINUTOS = 15;   // bloqueia por Z minutos

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
            ativo: true,
          },
        ],
        null,
        2
      )
    );
  }

  const usuarios = JSON.parse(fs.readFileSync(usuariosPath, "utf8"));

  // ✅ garante campo "ativo" nos usuários antigos (default true)
  let mudou = false;
  for (const u of usuarios) {
    if (typeof u.ativo !== "boolean") {
      u.ativo = true;
      mudou = true;
    }
  }
  if (mudou) {
    fs.writeFileSync(usuariosPath, JSON.stringify(usuarios, null, 2));
  }

  return usuarios;
}

function lerLoginLogs() {
  if (!fs.existsSync(loginLogsPath)) {
    fs.writeFileSync(loginLogsPath, JSON.stringify([], null, 2));
  }
  return JSON.parse(fs.readFileSync(loginLogsPath, "utf8"));
}

function salvarLoginLogs(logs) {
  fs.writeFileSync(loginLogsPath, JSON.stringify(logs, null, 2));
}

/**
 * Registra tentativa de login
 * resultado:
 * - "sucesso"
 * - "usuario_inativo"
 * - "credenciais_invalidas"
 * - "usuario_nao_encontrado"
 * - "bloqueado_por_tentativas"
 * - "desbloqueio_admin"
 */
function registrarTentativaLogin({ usuarioInformado, resultado, req, user = null, detalhe = null }) {
  try {
    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "";

    const userAgent = (req.headers["user-agent"] || "").toString();

    const logs = lerLoginLogs();

    logs.push({
      id: Date.now(),
      dataHora: new Date().toISOString(),
      usuarioInformado: String(usuarioInformado || "").trim(),
      resultado,
      detalhe,
      ip,
      userAgent,
      userId: user?.id ?? null,
      role: user?.role ?? null,
      ativo: typeof user?.ativo === "boolean" ? user.ativo : null,
    });

    // ✅ mantém o arquivo "enxuto" (últimos 2000 logs)
    const MAX = 2000;
    if (logs.length > MAX) {
      const slice = logs.slice(logs.length - MAX);
      salvarLoginLogs(slice);
      return;
    }

    salvarLoginLogs(logs);
  } catch (e) {
    console.warn("⚠️ Falha ao registrar tentativa de login:", e.message);
  }
}

/* ========= BLOQUEIO POR TENTATIVAS ========= */

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

function minutosParaMs(min) {
  return min * 60 * 1000;
}

function minutosRestantes(agora, ate) {
  const diff = ate.getTime() - agora.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 60000);
}

function getAttemptsEntry(attempts, userKey) {
  let entry = attempts.find((a) => String(a.usuario).toLowerCase() === String(userKey).toLowerCase());
  if (!entry) {
    entry = {
      usuario: userKey,
      failCount: 0,
      firstFailAt: null,
      lastFailAt: null,
      blockedUntil: null,
    };
    attempts.push(entry);
  }
  return entry;
}

function resetarAttempts(entry) {
  entry.failCount = 0;
  entry.firstFailAt = null;
  entry.lastFailAt = null;
  entry.blockedUntil = null;
}

// ✅ helper para admin desbloquear
function limparBloqueioPorUsuario(userKey) {
  const attempts = lerAttempts();
  const entry = attempts.find(
    (a) => String(a.usuario).toLowerCase() === String(userKey).toLowerCase()
  );

  if (!entry) return { found: false };

  resetarAttempts(entry);
  salvarAttempts(attempts);

  return { found: true };
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
   LOGIN -> devolve token
================================= */
router.post("/login", (req, res) => {
  const { usuario, senha } = req.body;

  const usuarioTrim = String(usuario || "").trim();
  const senhaStr = String(senha || "");
  const userKey = usuarioTrim.toLowerCase();
  const now = new Date();

  const attempts = lerAttempts();
  const entry = getAttemptsEntry(attempts, userKey);

  // ✅ se está bloqueado ainda, barra antes de tudo
  if (entry.blockedUntil) {
    const blockedUntilDate = new Date(entry.blockedUntil);
    if (now < blockedUntilDate) {
      const faltam = minutosRestantes(now, blockedUntilDate);

      registrarTentativaLogin({
        usuarioInformado: usuarioTrim,
        resultado: "bloqueado_por_tentativas",
        detalhe: `restante_min=${faltam}`,
        req,
        user: null,
      });

      return res.status(429).json({
        success: false,
        message: `Muitas tentativas inválidas. Tente novamente em ${faltam || 1} minuto(s).`,
      });
    }

    // bloqueio expirou -> reseta
    resetarAttempts(entry);
    salvarAttempts(attempts);
  }

  if (!usuarioTrim || !senhaStr) {
    registrarTentativaLogin({
      usuarioInformado: usuarioTrim,
      resultado: "credenciais_invalidas",
      detalhe: "usuario_ou_senha_vazio",
      req,
      user: null,
    });

    const firstFail = entry.firstFailAt ? new Date(entry.firstFailAt) : null;
    if (!firstFail || now.getTime() - firstFail.getTime() > minutosParaMs(JANELA_MINUTOS)) {
      entry.failCount = 1;
      entry.firstFailAt = now.toISOString();
    } else {
      entry.failCount += 1;
    }
    entry.lastFailAt = now.toISOString();

    if (entry.failCount >= MAX_TENTATIVAS) {
      entry.blockedUntil = new Date(now.getTime() + minutosParaMs(BLOQUEIO_MINUTOS)).toISOString();
    }
    salvarAttempts(attempts);

    return res.status(400).json({
      success: false,
      message: "Usuário e senha são obrigatórios",
    });
  }

  const usuarios = lerUsuarios();

  const userByLogin = usuarios.find(
    (u) => String(u.usuario).toLowerCase() === userKey
  );

  if (!userByLogin) {
    registrarTentativaLogin({
      usuarioInformado: usuarioTrim,
      resultado: "usuario_nao_encontrado",
      req,
      user: null,
    });

    const firstFail = entry.firstFailAt ? new Date(entry.firstFailAt) : null;
    if (!firstFail || now.getTime() - firstFail.getTime() > minutosParaMs(JANELA_MINUTOS)) {
      entry.failCount = 1;
      entry.firstFailAt = now.toISOString();
    } else {
      entry.failCount += 1;
    }
    entry.lastFailAt = now.toISOString();

    if (entry.failCount >= MAX_TENTATIVAS) {
      entry.blockedUntil = new Date(now.getTime() + minutosParaMs(BLOQUEIO_MINUTOS)).toISOString();

      registrarTentativaLogin({
        usuarioInformado: usuarioTrim,
        resultado: "bloqueado_por_tentativas",
        detalhe: `bloqueado_min=${BLOQUEIO_MINUTOS}`,
        req,
        user: null,
      });

      salvarAttempts(attempts);

      return res.status(429).json({
        success: false,
        message: `Muitas tentativas inválidas. Usuário bloqueado por ${BLOQUEIO_MINUTOS} minuto(s).`,
      });
    }

    salvarAttempts(attempts);

    return res.status(401).json({
      success: false,
      message: "Credenciais inválidas",
    });
  }

  if (userByLogin.ativo === false) {
    registrarTentativaLogin({
      usuarioInformado: usuarioTrim,
      resultado: "usuario_inativo",
      req,
      user: userByLogin,
    });

    return res.status(403).json({
      success: false,
      message: "Usuário desativado. Entrar em contato com o Administrador.",
    });
  }

  const senhaOk = String(userByLogin.senha) === senhaStr;
  if (!senhaOk) {
    registrarTentativaLogin({
      usuarioInformado: usuarioTrim,
      resultado: "credenciais_invalidas",
      req,
      user: userByLogin,
    });

    const firstFail = entry.firstFailAt ? new Date(entry.firstFailAt) : null;
    if (!firstFail || now.getTime() - firstFail.getTime() > minutosParaMs(JANELA_MINUTOS)) {
      entry.failCount = 1;
      entry.firstFailAt = now.toISOString();
    } else {
      entry.failCount += 1;
    }
    entry.lastFailAt = now.toISOString();

    if (entry.failCount >= MAX_TENTATIVAS) {
      entry.blockedUntil = new Date(now.getTime() + minutosParaMs(BLOQUEIO_MINUTOS)).toISOString();

      registrarTentativaLogin({
        usuarioInformado: usuarioTrim,
        resultado: "bloqueado_por_tentativas",
        detalhe: `userId=${userByLogin.id}; bloqueado_min=${BLOQUEIO_MINUTOS}`,
        req,
        user: userByLogin,
      });

      salvarAttempts(attempts);

      return res.status(429).json({
        success: false,
        message: `Muitas tentativas inválidas. Usuário bloqueado por ${BLOQUEIO_MINUTOS} minuto(s).`,
      });
    }

    salvarAttempts(attempts);

    return res.status(401).json({
      success: false,
      message: "Credenciais inválidas",
    });
  }

  // ✅ sucesso: reseta tentativas
  resetarAttempts(entry);
  salvarAttempts(attempts);

  registrarTentativaLogin({
    usuarioInformado: usuarioTrim,
    resultado: "sucesso",
    req,
    user: userByLogin,
  });

  const token = jwt.sign(
    { id: userByLogin.id, nome: userByLogin.nome, role: userByLogin.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    success: true,
    token,
    usuario: {
      id: userByLogin.id,
      nome: userByLogin.nome,
      role: userByLogin.role,
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
   ✅ LOGIN LOGS (ADMIN)
   GET /api/auth/login-logs?limit=200
================================= */
router.get("/login-logs", authJwt, somenteAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "200", 10) || 200, 2000);
  const logs = lerLoginLogs();
  const saida = logs.slice(-limit).reverse();
  return res.json(saida);
});

/* ===============================
   ✅ LISTAR BLOQUEADOS (ADMIN)
   GET /api/auth/locked
================================= */
router.get("/locked", authJwt, somenteAdmin, (req, res) => {
  const attempts = lerAttempts();
  const now = new Date();

  const locked = attempts
    .filter((a) => a.blockedUntil && now < new Date(a.blockedUntil))
    .map((a) => ({
      usuario: a.usuario,
      failCount: a.failCount,
      blockedUntil: a.blockedUntil,
      minutosRestantes: minutosRestantes(now, new Date(a.blockedUntil)),
      lastFailAt: a.lastFailAt,
    }))
    .sort((a, b) => new Date(b.blockedUntil) - new Date(a.blockedUntil));

  return res.json(locked);
});

/* ===============================
   ✅ DESBLOQUEAR USUÁRIO (ADMIN)
   POST /api/auth/unlock
   body: { usuario: "andressa" }
================================= */
router.post("/unlock", authJwt, somenteAdmin, (req, res) => {
  const usuario = String(req.body?.usuario || "").trim();
  if (!usuario) {
    return res.status(400).json({
      success: false,
      message: "Informe o usuário para desbloquear",
    });
  }

  const userKey = usuario.toLowerCase();
  const result = limparBloqueioPorUsuario(userKey);

  registrarTentativaLogin({
    usuarioInformado: usuario,
    resultado: "desbloqueio_admin",
    detalhe: `adminId=${req.usuario.id}; adminNome=${req.usuario.nome}`,
    req,
    user: { id: null, role: null, ativo: null },
  });

  if (!result.found) {
    return res.status(404).json({
      success: false,
      message: "Usuário não possui registro de tentativas/bloqueio",
    });
  }

  return res.json({
    success: true,
    message: `Usuário '${usuario}' desbloqueado com sucesso.`,
  });
});

/* ===============================
   LOGOUT -> em JWT é no client
================================= */
router.post("/logout", (req, res) => {
  return res.json({ logout: true });
});

module.exports = router;