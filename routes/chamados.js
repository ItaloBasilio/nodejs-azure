var express = require('express');
var router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const chamadosController = require('../controllers/chamadosController');

function verificarLogin(req, res, next) {
    if (!req.session.logado) {
        return res.status(401).json({ error: "Não autorizado" });
    }
    next();
}

// 🔐 Protege TODAS as rotas abaixo
router.use(verificarLogin);



// =============================
// CONFIGURAÇÃO DO MULTER
// =============================

// Garante que a pasta uploads exista
const uploadPath = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const extensao = path.extname(file.originalname);
        const nomeArquivo = Date.now() + '-' + Math.round(Math.random() * 1E9) + extensao;
        cb(null, nomeArquivo);
    }
});

// Filtro de tipos permitidos
function fileFilter(req, file, cb) {
    const tiposPermitidos = /jpeg|jpg|png|pdf/;
    const extname = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
    const mimetype = tiposPermitidos.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error("Apenas imagens (JPG, PNG) ou PDF são permitidos"));
    }
}

// Inicializa multer
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});



// =============================
// ROTAS
// =============================

// Listar todos
router.get('/', chamadosController.listarChamados);

// Buscar por ID
router.get('/:id', chamadosController.buscarChamadoPorId);

// Criar chamado COM upload
router.post('/', upload.array('anexos', 5), chamadosController.criarChamado);

router.post('/:id/anexo', upload.array('anexos'), chamadosController.adicionarAnexo);

// Atualizar chamado
router.put('/:id', chamadosController.atualizarChamado);

// Adicionar interação e mudar status automaticamente
router.put('/:id/interacao', chamadosController.adicionarInteracao);

// Deletar chamado
router.delete('/:id', chamadosController.deletarChamado);

// Remover anexo
router.delete('/:id/anexo/:nomeArquivo', chamadosController.removerAnexo);



module.exports = router;