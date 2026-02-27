const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../chamados.json");
const usuariosPath = path.join(__dirname, "../usuarios.json");

function lerChamados() {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "[]");
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function salvarChamados(chamados) {
  fs.writeFileSync(filePath, JSON.stringify(chamados, null, 2));
}

function lerUsuarios() {
  if (!fs.existsSync(usuariosPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(usuariosPath, "utf8"));
  } catch {
    return [];
  }
}

// helper: usuário vem do JWT middleware (authJwt)
function getUsuario(req) {
  return req.usuario || { nome: "Desconhecido", role: "analista", id: null };
}

function normalizarTexto(s) {
  return (s || "").toString().trim().toLowerCase();
}

// =============================
// ✅ MEUS CHAMADOS
// =============================
exports.listarMeusChamados = (req, res) => {
  const usuario = getUsuario(req);
  const chamados = lerChamados();

  const meuNome = normalizarTexto(usuario.nome);

  const meus = chamados.filter((c) => {
    const criadoPor = normalizarTexto(c?.criadoPor);
    return criadoPor && criadoPor === meuNome;
  });

  meus.sort((a, b) => Number(b.id) - Number(a.id));
  res.json(meus);
};

// =============================
// LISTAR TODOS
// =============================
exports.listarChamados = (req, res) => {
  const chamados = lerChamados();
  chamados.sort((a, b) => Number(b.id) - Number(a.id));
  res.json(chamados);
};

// =============================
// BUSCAR POR ID
// =============================
exports.buscarChamadoPorId = (req, res) => {
  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);

  if (!chamado) return res.status(404).json({ error: "Chamado não encontrado" });

  if (!chamado.interacoes) chamado.interacoes = [];
  if (!chamado.anexos) chamado.anexos = [];
  if (!chamado.dataCriacao) chamado.dataCriacao = new Date().toISOString();

  // ✅ compat: garante analistaResponsavel antigo
  if (!chamado.analistaResponsavel) {
    chamado.analistaResponsavel = chamado.criadoPor || null;
  }

  res.json(chamado);
};

// =============================
// CRIAR CHAMADO (COM ANEXOS)
// ✅ agora salva analistaResponsavel = usuário logado
// =============================
exports.criarChamado = (req, res) => {
  const chamados = lerChamados();
  const usuario = getUsuario(req);

  const { titulo, cliente, categoria, descricao, prioridade, solicitante } = req.body;

  if (!titulo || !cliente || !categoria || !descricao || !prioridade || !solicitante) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios" });
  }

  let anexos = [];
  if (req.files && req.files.length > 0) {
    anexos = req.files.map((file) => ({
      nomeOriginal: file.originalname,
      nomeSalvo: file.filename,
      caminho: `/uploads/${file.filename}`,
      dataUpload: new Date().toISOString(),
      enviadoPor: usuario.nome,
    }));
  }

  const novoChamado = {
    id: Date.now().toString(),
    titulo: String(titulo).trim(),
    cliente: String(cliente).trim(),
    categoria: String(categoria).trim(),
    descricao: String(descricao).trim(),
    prioridade: String(prioridade).trim(),
    solicitante: String(solicitante).trim(),
    status: "Aberto",
    dataCriacao: new Date().toISOString(),

    criadoPor: usuario.nome,
    analistaResponsavel: usuario.nome, // ✅ NOVO: primeiro responsável = quem criou

    interacoes: [],
    anexos,
  };

  chamados.push(novoChamado);
  salvarChamados(chamados);

  res.status(201).json(novoChamado);
};

// =============================
// ADICIONAR ANEXO EM CHAMADO EXISTENTE
// =============================
exports.adicionarAnexo = (req, res) => {
  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);
  const usuario = getUsuario(req);

  if (!chamado) return res.status(404).json({ error: "Chamado não encontrado" });

  if (!chamado.anexos) chamado.anexos = [];

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }

  const novosAnexos = req.files.map((file) => ({
    nomeOriginal: file.originalname,
    nomeSalvo: file.filename,
    caminho: `/uploads/${file.filename}`,
    dataUpload: new Date().toISOString(),
    enviadoPor: usuario.nome,
  }));

  chamado.anexos.push(...novosAnexos);
  salvarChamados(chamados);

  res.json({
    message: "Anexo(s) adicionado(s) com sucesso",
    anexos: chamado.anexos,
  });
};

// =============================
// ✅ ATRIBUIR / ASSUMIR ANALISTA (NOVO)
// PUT /api/chamados/:id/analista
// - Admin pode atribuir para qualquer usuário existente
// - Analista só pode assumir para ele mesmo
// =============================
exports.definirAnalistaResponsavel = (req, res) => {
  const usuario = getUsuario(req);
  const chamados = lerChamados();

  const idx = chamados.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Chamado não encontrado" });

  const chamadoAtual = chamados[idx];

  const bodyNome = (req.body?.analistaResponsavel || "").toString().trim();

  // ✅ analista: só pode assumir para si mesmo
  if (usuario.role !== "admin") {
    chamados[idx] = {
      ...chamadoAtual,
      analistaResponsavel: usuario.nome,
    };
    salvarChamados(chamados);

    return res.json({
      message: "Chamado assumido com sucesso",
      chamado: chamados[idx],
    });
  }

  // ✅ admin: pode escolher um nome (valida existir em usuarios.json)
  if (!bodyNome) {
    return res.status(400).json({ error: "Informe analistaResponsavel" });
  }

  const usuarios = lerUsuarios();
  const existe = usuarios.find((u) => normalizarTexto(u?.nome) === normalizarTexto(bodyNome));

  if (!existe) {
    return res.status(400).json({ error: "Analista informado não existe em usuarios.json" });
  }

  chamados[idx] = {
    ...chamadoAtual,
    analistaResponsavel: existe.nome, // usa nome oficial do cadastro
  };

  salvarChamados(chamados);

  return res.json({
    message: "Analista responsável atualizado com sucesso",
    chamado: chamados[idx],
  });
};

// =============================
// ATUALIZAR CHAMADO
// (mantém regra: não-admin não altera tudo)
// ✅ agora permite analista alterar prioridade também
// =============================
exports.atualizarChamado = (req, res) => {
  const usuario = getUsuario(req);
  let chamados = lerChamados();

  const idx = chamados.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Chamado não encontrado" });

  const chamadoAtual = chamados[idx];

  let patch = req.body || {};

  // admin pode tudo
  if (usuario.role !== "admin") {
    const permitido = {};

    // ✅ analista pode mudar status (como já fazia)
    if (typeof patch.status === "string") permitido.status = patch.status;

    // ✅ analista pode mudar prioridade (você pediu no detalhe)
    if (typeof patch.prioridade === "string") permitido.prioridade = patch.prioridade;

    patch = permitido;
  }

  chamados[idx] = { ...chamadoAtual, ...patch };

  salvarChamados(chamados);
  res.json({ message: "Chamado atualizado", chamado: chamados[idx] });
};

// =============================
// ADICIONAR INTERAÇÃO
// =============================
exports.adicionarInteracao = (req, res) => {
  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);
  const usuario = getUsuario(req);

  if (!chamado) return res.status(404).json({ error: "Chamado não encontrado" });

  if (!chamado.interacoes) chamado.interacoes = [];

  const mensagem = (req.body?.mensagem || "").toString().trim();
  if (!mensagem) return res.status(400).json({ error: "Mensagem é obrigatória" });

  const novaInteracao = {
    data: new Date().toISOString(),
    autor: usuario.nome,
    role: usuario.role,
    mensagem,
  };

  chamado.interacoes.push(novaInteracao);

  if (chamado.status === "Aberto") {
    chamado.status = "Em Atendimento";
  }

  salvarChamados(chamados);

  res.json({ message: "Interação adicionada com sucesso", chamado });
};

// =============================
// DELETAR CHAMADO (SOMENTE ADMIN)
// =============================
exports.deletarChamado = (req, res) => {
  const usuario = getUsuario(req);
  if (usuario.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem deletar chamados" });
  }

  let chamados = lerChamados();
  chamados = chamados.filter((chamado) => chamado.id !== req.params.id);

  salvarChamados(chamados);
  res.json({ message: "Chamado deletado" });
};

// =============================
// REMOVER ANEXO (SOMENTE ADMIN)
// =============================
exports.removerAnexo = (req, res) => {
  const usuario = getUsuario(req);
  if (usuario.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem remover anexos" });
  }

  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);

  if (!chamado) return res.status(404).json({ error: "Chamado não encontrado" });
  if (!chamado.anexos) return res.status(400).json({ error: "Nenhum anexo encontrado" });

  const nomeArquivo = req.params.nomeArquivo;

  const antes = chamado.anexos.length;
  chamado.anexos = chamado.anexos.filter((a) => a.nomeSalvo !== nomeArquivo);

  if (chamado.anexos.length === antes) {
    return res.status(404).json({ error: "Anexo não encontrado" });
  }

  const caminhoArquivo = path.join(__dirname, "../public/uploads", nomeArquivo);
  if (fs.existsSync(caminhoArquivo)) fs.unlinkSync(caminhoArquivo);

  salvarChamados(chamados);
  res.json({ message: "Anexo removido com sucesso" });
};