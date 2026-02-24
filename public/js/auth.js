// public/js/auth.js

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

  try {
    const res = await authFetch("/api/auth/check");

    if (!res.ok) {
      clearToken();
      if (!isLoginPage()) window.location.href = "/login";
      return false;
    }

    return true;
  } catch (err) {
    console.error("❌ Erro ao validar token:", err);
    clearToken();
    if (!isLoginPage()) window.location.href = "/login";
    return false;
  }
}

/**
 * Aplica permissões no menu:
 * - Mostra itens ADMIN somente quando role === "admin"
 *   #menuUsuarios (Gestão de Usuários)
 *   #menuClientes (Gestão de Clientes)
 */
function aplicarPermissoesMenu(data) {
  const menuUsuarios = document.getElementById("menuUsuarios");
  const menuClientes = document.getElementById("menuClientes");

  const isAdmin = data?.usuario?.role === "admin";

  if (menuUsuarios) {
    if (isAdmin) menuUsuarios.classList.remove("d-none");
    else menuUsuarios.classList.add("d-none");
  }

  if (menuClientes) {
    if (isAdmin) menuClientes.classList.remove("d-none");
    else menuClientes.classList.add("d-none");
  }
}

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

  try {
    const res = await authFetch("/api/auth/check");
    if (!res.ok) {
      console.warn("⚠️ /api/auth/check não OK:", res.status);
      return;
    }

    const data = await res.json().catch(() => null);

    // ✅ aplica permissões do menu com base na role
    aplicarPermissoesMenu(data);

    if (el && data?.usuario?.nome) {
      el.innerText = `Bem-vindo, ${data.usuario.nome}`;
    } else {
      if (el) el.innerText = "Bem-vindo";
      console.warn("⚠️ Resposta de /api/auth/check sem usuario.nome:", data);
    }
  } catch (err) {
    console.error("❌ Erro ao carregar usuário:", err);
    if (!isLoginPage()) window.location.href = "/login";
  }
}

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
    window.location.href = "/login";
  }
}