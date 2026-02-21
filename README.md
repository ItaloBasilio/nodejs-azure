# 🛠️ Service Desk Inteligente

Sistema de **Service Desk** desenvolvido com **Node.js**, **Bootstrap** e **Inteligência Artificial**, com foco em organização de chamados, automação de atendimentos e apoio à tomada de decisão.

O projeto foi pensado para ser simples de usar, escalável e preparado para futuras integrações com APIs de IA e serviços externos.

---

## 🚀 Tecnologias Utilizadas

- **Node.js**
- **Express**
- **Bootstrap**
- **EJS (Embedded JavaScript Templates)**
- **JWT (JSON Web Token)** para autenticação
- **IA (Inteligência Artificial)** para apoio ao atendimento e análise de chamados
- **JSON** para persistência inicial de dados

---

## 🎯 Objetivo do Projeto

Criar uma solução de Service Desk capaz de:

- Centralizar chamados de suporte
- Facilitar o acompanhamento do status dos atendimentos
- Automatizar análises e respostas com apoio de IA
- Oferecer uma interface simples, limpa e responsiva
- Servir como base para evolução futura (banco de dados, APIs externas, chatbot, etc.)

---

## 📂 Estrutura do Projeto

```bash
├── controllers/
│   ├── authController.js
│   └── chamadosController.js
│
├── middlewares/
│   └── auth.js
│
├── routes/
│   ├── authRoutes.js
│   └── chamadosRoutes.js
│
├── views/
│   ├── partials/
│   │   └── sidebar.ejs
│   ├── dashboard.ejs
│   └── login.ejs
│
├── public/
│   ├── css/
│   └── js/
│
├── data/
│   ├── chamados.json
│   └── usuarios.json
│
├── app.js
├── package.json
└── README.md

🔐 Autenticação

O sistema utiliza JWT (JSON Web Token) para autenticação, garantindo:

Sessões seguras

Controle de acesso por usuário

Proteção de rotas sensíveis

📊 Funcionalidades Atuais

Login com autenticação JWT

Dashboard com visão geral dos chamados:

Abertos

Em atendimento

Resolvidos

Críticos

Listagem dinâmica dos últimos chamados via API

Interface responsiva com Bootstrap

Estrutura preparada para integração com IA

