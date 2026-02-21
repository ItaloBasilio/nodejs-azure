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



// =============================
// LISTAR TODOS
// =============================
exports.listarChamados = (req, res) => {
    const chamados = lerChamados();
    res.json(chamados);
};



// =============================
// BUSCAR POR ID
// =============================
exports.buscarChamadoPorId = (req, res) => {
    const chamados = lerChamados();
    const chamado = chamados.find(c => c.id === req.params.id);

    if (!chamado) {
        return res.status(404).json({ error: "Chamado não encontrado" });
    }

    if (!chamado.interacoes) {
        chamado.interacoes = [];
    }

    if (!chamado.anexos) {
        chamado.anexos = [];
    }

    res.json(chamado);
};



// =============================
// CRIAR CHAMADO (COM ANEXOS)
// =============================
exports.criarChamado = (req, res) => {
    const chamados = lerChamados();

    // 🔥 Processa arquivos enviados pelo Multer
    let anexos = [];

    if (req.files && req.files.length > 0) {
        anexos = req.files.map(file => ({
            nomeOriginal: file.originalname,
            nomeSalvo: file.filename,
            caminho: `/uploads/${file.filename}`,
            dataUpload: new Date().toISOString()
        }));
    }

    const novoChamado = {
        id: Date.now().toString(),
        titulo: req.body.titulo,
        categoria: req.body.categoria,
        descricao: req.body.descricao,
        prioridade: req.body.prioridade,
        solicitante: req.body.solicitante,
        status: "Aberto",
        dataCriacao: new Date().toISOString(),
        interacoes: [],
        anexos: anexos
    };

    chamados.push(novoChamado);
    salvarChamados(chamados);

    res.status(201).json(novoChamado);
};



// =============================
// ATUALIZAR CHAMADO
// =============================
exports.atualizarChamado = (req, res) => {
    let chamados = lerChamados();

    chamados = chamados.map(chamado =>
        chamado.id === req.params.id
            ? { ...chamado, ...req.body }
            : chamado
    );

    salvarChamados(chamados);
    res.json({ message: "Chamado atualizado" });
};



// =============================
// ADICIONAR INTERAÇÃO
// =============================
exports.adicionarInteracao = (req, res) => {
    const chamados = lerChamados();
    const chamado = chamados.find(c => c.id === req.params.id);

    if (!chamado) {
        return res.status(404).json({ error: "Chamado não encontrado" });
    }

    if (!chamado.interacoes) {
        chamado.interacoes = [];
    }

    const novaInteracao = {
        data: new Date().toISOString(),
        autor: req.body.autor || "Analista",
        mensagem: req.body.mensagem
    };

    chamado.interacoes.push(novaInteracao);

    // 🔥 Regra automática de negócio
    if (chamado.status === "Aberto") {
        chamado.status = "Em Atendimento";
    }

    salvarChamados(chamados);

    res.json({ message: "Interação adicionada com sucesso", chamado });
};



// =============================
// DELETAR CHAMADO
// =============================
exports.deletarChamado = (req, res) => {
    let chamados = lerChamados();

    chamados = chamados.filter(chamado => chamado.id !== req.params.id);

    salvarChamados(chamados);

    res.json({ message: "Chamado deletado" });

    
};

// =============================
// REMOVER ANEXO
// =============================
exports.removerAnexo = (req, res) => {
    const chamados = lerChamados();
    const chamado = chamados.find(c => c.id === req.params.id);

    if (!chamado) {
        return res.status(404).json({ error: "Chamado não encontrado" });
    }

    if (!chamado.anexos) {
        return res.status(400).json({ error: "Nenhum anexo encontrado" });
    }

    const nomeArquivo = req.params.nomeArquivo;

    // Remove do array
    chamado.anexos = chamado.anexos.filter(a => a.nomeSalvo !== nomeArquivo);

    // Remove o arquivo físico
    const caminhoArquivo = path.join(__dirname, "../public/uploads", nomeArquivo);

    if (fs.existsSync(caminhoArquivo)) {
        fs.unlinkSync(caminhoArquivo);
    }

    salvarChamados(chamados);

    res.json({ message: "Anexo removido com sucesso" });
};