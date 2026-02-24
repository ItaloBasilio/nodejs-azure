const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../chamados.json");

function lerChamados() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]");
  }
  const data = fs.readFileSync(filePath);
  return JSON.parse(data);
}

function salvarChamados(chamados) {
  fs.writeFileSync(filePath, JSON.stringify(chamados, null, 2));
}

// helper: usuário vem do JWT middleware (authJwt)
function getUsuario(req) {
  return req.usuario || { nome: "Desconhecido", role: "analista" };
}

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

  if (!chamado) {
    return res.status(404).json({ error: "Chamado não encontrado" });
  }

  if (!chamado.interacoes) chamado.interacoes = [];
  if (!chamado.anexos) chamado.anexos = [];
  if (!chamado.dataCriacao) chamado.dataCriacao = new Date().toISOString();

  res.json(chamado);
};

// =============================
// CRIAR CHAMADO (COM ANEXOS)
// =============================
exports.criarChamado = (req, res) => {
  const chamados = lerChamados();
  const usuario = getUsuario(req);

  // validações básicas
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
    cliente: String(cliente).trim(), // ✅ NOVO CAMPO
    categoria: String(categoria).trim(),
    descricao: String(descricao).trim(),
    prioridade: String(prioridade).trim(),
    solicitante: String(solicitante).trim(),
    status: "Aberto",
    dataCriacao: new Date().toISOString(),
    criadoPor: usuario.nome,
    interacoes: [],
    anexos,
  };

  chamados.push(novoChamado);
  salvarChamados(chamados);

  res.status(201).json(novoChamado);
};

// =============================
// ADICIONAR ANEXO EM CHAMADO EXISTENTE
// (admin e analista podem adicionar; só admin remove)
// =============================
exports.adicionarAnexo = (req, res) => {
  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);
  const usuario = getUsuario(req);

  if (!chamado) {
    return res.status(404).json({ error: "Chamado não encontrado" });
  }

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
// ATUALIZAR CHAMADO
// (protege campos sensíveis: analista não pode alterar tudo)
// =============================
exports.atualizarChamado = (req, res) => {
  const usuario = getUsuario(req);
  let chamados = lerChamados();

  const idx = chamados.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: "Chamado não encontrado" });
  }

  const chamadoAtual = chamados[idx];

  // admin pode tudo; analista só pode mudar status (ex.: resolver)
  let patch = req.body || {};

  if (usuario.role !== "admin") {
    const permitido = {};
    if (typeof patch.status === "string") permitido.status = patch.status;
    patch = permitido;
  }

  chamados[idx] = { ...chamadoAtual, ...patch };

  salvarChamados(chamados);
  res.json({ message: "Chamado atualizado" });
};

// =============================
// ADICIONAR INTERAÇÃO (autor automático pelo token)
// =============================
exports.adicionarInteracao = (req, res) => {
  const chamados = lerChamados();
  const chamado = chamados.find((c) => c.id === req.params.id);
  const usuario = getUsuario(req);

  if (!chamado) {
    return res.status(404).json({ error: "Chamado não encontrado" });
  }

  if (!chamado.interacoes) chamado.interacoes = [];

  const mensagem = (req.body?.mensagem || "").toString().trim();
  if (!mensagem) {
    return res.status(400).json({ error: "Mensagem é obrigatória" });
  }

  const novaInteracao = {
    data: new Date().toISOString(),
    autor: usuario.nome,
    role: usuario.role,
    mensagem,
  };

  chamado.interacoes.push(novaInteracao);

  // regra automática
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

  if (!chamado) {
    return res.status(404).json({ error: "Chamado não encontrado" });
  }

  if (!chamado.anexos) {
    return res.status(400).json({ error: "Nenhum anexo encontrado" });
  }

  const nomeArquivo = req.params.nomeArquivo;

  const antes = chamado.anexos.length;
  chamado.anexos = chamado.anexos.filter((a) => a.nomeSalvo !== nomeArquivo);

  if (chamado.anexos.length === antes) {
    return res.status(404).json({ error: "Anexo não encontrado" });
  }

  const caminhoArquivo = path.join(__dirname, "../public/uploads", nomeArquivo);
  if (fs.existsSync(caminhoArquivo)) {
    fs.unlinkSync(caminhoArquivo);
  }

  salvarChamados(chamados);

  res.json({ message: "Anexo removido com sucesso" });
};