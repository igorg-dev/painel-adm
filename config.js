// admin-panel/js/config.js — CONSTANTES DO PAINEL
// Valores fixos usados por vários arquivos do painel. Os scripts do painel NÃO usam módulos (import/export):
// são carregados por <script> em ordem no index.html e compartilham o escopo global, então a ORDEM de carregamento importa.

// Endereço base da API, vindo do shared/app-config.js.
const API_URL = APP_CONFIG.apiUrl;
// Chaves do localStorage onde ficam o token JWT e os dados do usuário logado.
const STORAGE_KEYS = { token: APP_CONFIG.session.tokenKey, user: APP_CONFIG.session.userKey };
// Quantas movimentações carregar por vez na tela (botão 'Carregar mais').
const MOVEMENT_PAGE_SIZE = 50;
// Na exportação CSV, busca em blocos de 500 (máximo aceito pela API)...
const EXPORT_PAGE_SIZE = 500;
// ...e para após 40 blocos (20.000 linhas) como proteção contra exportações gigantes.
const EXPORT_MAX_PAGES = 40;
// Imagem substituta (um SVG cinza embutido como data URI) usada quando a foto do produto não carrega.
const FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#e3e8ee"/><path d="M20 42l14-16 10 11 8-8 8 13z" fill="#b8c2cf"/></svg>');
