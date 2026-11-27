// admin-panel/js/api.js — COMUNICAÇÃO COM A API E SESSÃO
//
// Contém 4 classes:
//  - ApiError       : erro padronizado de chamadas à API;
//  - SessionManager : guarda/lê token e usuário no localStorage;
//  - ApiClient      : faz as requisições fetch (já com o token);
//  - Product        : modelo de produto com um método de regra de estoque.

// Erro de API com `status` HTTP e a lista `errors` por campo (a mesma enviada pelo backend). status 0 = servidor inalcançável.
class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// Gerencia a sessão do administrador no navegador (localStorage persiste mesmo fechando a aba).
class SessionManager {
  // Lê o token JWT.
  getToken() {
    return localStorage.getItem(STORAGE_KEYS.token);
  }

  // Lê o usuário salvo. try/catch porque o JSON no storage pode estar corrompido.
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.user));
    } catch (error) {
      return null;
    }
  }

  // Guarda token e usuário após o login.
  save(token, user) {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  }

  // Apaga a sessão (logout).
  clear() {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
  }

  // Há token E o usuário salvo tem papel 'admin'? Usado para proteger o painel no lado do cliente (a proteção real é no backend).
  isAdmin() {
    const user = this.getUser();
    return Boolean(this.getToken() && user && user.role === 'admin');
  }
}

// Cliente HTTP do painel.
class ApiClient {
  constructor(baseUrl, session) {
    this.baseUrl = baseUrl;
    this.session = session;
    // Função chamada quando a API responde 401 (sessão expirada); definida pelo App para fazer logout.
    this.onUnauthorized = null;
  }

  // Monta a URL completa e adiciona a query string, ignorando parâmetros vazios/nulos.
  buildUrl(path, params) {
    const url = new URL(this.baseUrl + path, window.location.href);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== '' && value !== null && value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  // Método central: toda chamada à API passa por aqui.
  async request(method, path, { params, body } = {}) {
    // Envia JSON. Se houver token, acrescenta  Authorization: Bearer <token>.
    const headers = { 'Content-Type': 'application/json' };
    const token = this.session.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    let response;
    try {
      // Faz a requisição. Se o fetch lançar erro, é falha de rede/servidor fora do ar.
      response = await fetch(this.buildUrl(path, params), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      // status 0 = não houve resposta do servidor.
      throw new ApiError(0, 'Não foi possível se comunicar com o servidor. Verifique se o backend está em execução.');
    }

    let data = null;
    try {
      // Tenta ler o corpo como JSON; respostas sem corpo viram null.
      data = await response.json();
    } catch (error) {
      data = null;
    }

    // Status fora de 200-299 = erro: converte em ApiError com a mensagem e os detalhes do backend.
    if (!response.ok) {
      // 401 em qualquer rota (exceto no próprio login, onde 401 = senha errada) significa sessão expirada: dispara o logout automático.
      if (response.status === 401 && path !== '/auth/login' && this.onUnauthorized) {
        this.onUnauthorized();
      }
      throw new ApiError(response.status, (data && data.message) || 'Erro inesperado.', (data && data.errors) || []);
    }
    return data;
  }

  // Atalhos para os métodos HTTP.
  get(path, params) {
    return this.request('GET', path, { params });
  }

  post(path, body) {
    return this.request('POST', path, { body });
  }

  put(path, body) {
    return this.request('PUT', path, { body });
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

// Modelo de produto: copia os dados vindos da API e acrescenta comportamento.
class Product {
  constructor(data) {
    Object.assign(this, data);
  }

  // Classifica o saldo (mesma regra do backend): 0 = esgotado, até o limite = baixo, acima = normal.
  stockStatus(threshold) {
    if (this.stock === 0) return 'out';
    if (this.stock <= threshold) return 'low';
    return 'ok';
  }
}
