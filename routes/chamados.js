const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { authJwt } = require("../middlewares/authJwt");
const chamadosController = require("../controllers/chamadosController");

// 🔐 Protege TODAS as rotas abaixo com JWT
router.use(authJwt);

// =============================
// CONFIGURAÇÃO DO MULTER
// =============================

// Garante que a pasta uploads exista
const uploadPath = path.join(__dirname, "../public/uploads");

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
    const nomeArquivo =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + extensao;
    cb(null, nomeArquivo);
  },
});

// Filtro de tipos permitidos
function fileFilter(req, file, cb) {
  const tiposPermitidos = /jpeg|jpg|png|pdf/;
  const extname = tiposPermitidos.test(
    path.extname(file.originalname).toLowerCase()
  );
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
  fileFilter: fileFilter,
});

// =============================
// ROTAS
// =============================

// ✅ Meus chamados (PRECISA vir ANTES de "/:id")
router.get("/meus", chamadosController.listarMeusChamados);

// Listar todos
router.get("/", chamadosController.listarChamados);

// Buscar por ID
router.get("/:id", chamadosController.buscarChamadoPorId);

// Criar chamado COM upload
router.post("/", upload.array("anexos", 5), chamadosController.criarChamado);

// Adicionar anexo em chamado existente
router.post(
  "/:id/anexo",
  upload.array("anexos", 5),
  chamadosController.adicionarAnexo
);

// Atualizar chamado
router.put("/:id", chamadosController.atualizarChamado);

// Adicionar interação e mudar status automaticamente
router.put("/:id/interacao", chamadosController.adicionarInteracao);

// Deletar chamado (somente admin - validado no controller)
router.delete("/:id", chamadosController.deletarChamado);

// Remover anexo (somente admin - validado no controller)
router.delete("/:id/anexo/:nomeArquivo", chamadosController.removerAnexo);

module.exports = router;