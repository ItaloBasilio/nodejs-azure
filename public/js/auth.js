// public/js/auth.js

/* =========================
   TOKEN HELPERS
========================= */
function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

function isLoginPage() {
  return window.location.pathname === "/login";
}

/* =========================
   AUTH FETCH
========================= */
/**
 * authFetch:
 * - Sempre injeta Authorization: Bearer <token>
 * - NÃO quebra FormData (não seta Content-Type manualmente)
 * - Suporta options.headers como objeto ou Headers()
 */
async function authFetch(url, options = {}) {
  const token = getToken();

  // Normaliza headers para objeto simples
  let headers = {};
  if (options.headers instanceof Headers) {
    headers = Object.fromEntries(options.headers.entries());
  } else if (options.headers && typeof options.headers === "object") {
    headers = { ...options.headers };
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/* =========================
   CHECK / CACHE DO USUÁRIO
========================= */

let __authCache = {
  at: 0,
  data: null,
};

async function getAuthCheck(force = false) {
  const token = getToken();
  if (!token) return null;

  const now = Date.now();
  // cache curto só pra evitar múltiplas chamadas na mesma tela
  if (!force && __authCache.data && now - __authCache.at < 15000) {
    return __authCache.data;
  }

  try {
    const res = await authFetch("/api/auth/check");
    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    __authCache = { at: now, data };
    return data;
  } catch (err) {
    console.error("❌ Erro ao chamar /api/auth/check:", err);
    return null;
  }
}

/**
 * Verifica token chamando /api/auth/check
 * - Se inválido: remove token e redireciona
 */
async function verificarLogin() {
  const token = getToken();

  if (!token) {
    if (!isLoginPage()) window.location.href = "/login";
    return false;
  }

  const data = await getAuthCheck(true);
  if (!data?.logado) {
    clearToken();
    if (!isLoginPage()) window.location.href = "/login";
    return false;
  }

  return true;
}

/* =========================
   PERMISSÕES / MENU
========================= */

/**
 * Aplica permissões no menu:
 * - Mostra itens ADMIN somente quando role === "admin"
 *   #menuUsuarios (Gestão de Usuários)
 *   #menuClientes (Gestão de Clientes)
 *   #menuCategorias (Gestão de Categorias)
 *   #menuGrupos (Gestão de Grupos)
 *   #menuLogsLogin (Logs de Login)
 *   #menuBloqueiosLogin (Bloqueios de Login) ✅
 */
function aplicarPermissoesMenu(data) {
  const menuUsuarios = document.getElementById("menuUsuarios");
  const menuClientes = document.getElementById("menuClientes");
  const menuCategorias = document.getElementById("menuCategorias");
  const menuGrupos = document.getElementById("menuGrupos");
  const menuLogsLogin = document.getElementById("menuLogsLogin");
  const menuBloqueiosLogin = document.getElementById("menuBloqueiosLogin");

  const isAdmin = data?.usuario?.role === "admin";

  if (menuUsuarios) {
    if (isAdmin) menuUsuarios.classList.remove("d-none");
    else menuUsuarios.classList.add("d-none");
  }

  if (menuClientes) {
    if (isAdmin) menuClientes.classList.remove("d-none");
    else menuClientes.classList.add("d-none");
  }

  if (menuCategorias) {
    if (isAdmin) menuCategorias.classList.remove("d-none");
    else menuCategorias.classList.add("d-none");
  }

  if (menuGrupos) {
    if (isAdmin) menuGrupos.classList.remove("d-none");
    else menuGrupos.classList.add("d-none");
  }

  if (menuLogsLogin) {
    if (isAdmin) menuLogsLogin.classList.remove("d-none");
    else menuLogsLogin.classList.add("d-none");
  }

  // ✅ novo menu: Bloqueios de Login
  if (menuBloqueiosLogin) {
    if (isAdmin) menuBloqueiosLogin.classList.remove("d-none");
    else menuBloqueiosLogin.classList.add("d-none");
  }
}

/**
 * (Opcional) Protege páginas admin no FRONT:
 * Use em páginas admin: await exigirAdmin();
 */
async function exigirAdmin() {
  const ok = await verificarLogin();
  if (!ok) return false;

  const data = await getAuthCheck();
  const isAdmin = data?.usuario?.role === "admin";

  if (!isAdmin) {
    alert("Acesso negado. Apenas ADMIN.");
    window.location.href = "/";
    return false;
  }

  return true;
}

/* =========================
   USUÁRIO LOGADO / UI
========================= */

/**
 * Carrega o usuário e escreve no elemento #userName.
 * - Também aplica permissões do menu (admin).
 * - Se não encontrar o elemento, não quebra.
 */
async function carregarUsuarioLogado() {
  const el = document.getElementById("userName");
  if (el) el.innerText = "Bem-vindo";

  const ok = await verificarLogin();
  if (!ok) return;

  const data = await getAuthCheck();
  if (!data) {
    console.warn("⚠️ Não foi possível obter /api/auth/check.");
    return;
  }

  // ✅ aplica permissões do menu com base na role
  aplicarPermissoesMenu(data);

  if (el && data?.usuario?.nome) {
    el.innerText = `Bem-vindo, ${data.usuario.nome}`;
  } else {
    if (el) el.innerText = "Bem-vindo";
    console.warn("⚠️ Resposta de /api/auth/check sem usuario.nome:", data);
  }
}

/* =========================
   LOGOUT
========================= */

/**
 * Logout no JWT é client-side.
 * Mantemos compatível com sua rota /api/auth/logout.
 */
async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    // ignora
  } finally {
    clearToken();
    __authCache = { at: 0, data: null };
    window.location.href = "/login";
  }
}