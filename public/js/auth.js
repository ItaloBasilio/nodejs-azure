// public/js/auth.js

function getToken() {
    return localStorage.getItem("token");
}

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = options.headers || {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
        ...options,
        headers
    });
}

async function carregarUsuarioLogado() {
    try {
        const response = await authFetch("/api/auth/check");

        if (!response.ok) {
            window.location.href = "/login";
            return;
        }

        const data = await response.json();

        const el = document.getElementById("userName");
        if (el && data.usuario?.nome) {
            el.innerText = `Bem-vindo, ${data.usuario.nome}`;
        }
    } catch (err) {
        console.error("Erro ao validar token", err);
        window.location.href = "/login";
    }
}

function logout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
}