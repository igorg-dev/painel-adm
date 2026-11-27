// admin-panel/js/utils.js — FUNÇÕES UTILITÁRIAS DO PAINEL
// Formatação (dinheiro, data), segurança (escapeHtml), leitura de números digitados, avisos (toast),
// exportação CSV e geração de pequenos pedaços de HTML reutilizados pelas telas.

// Formatador de moeda do navegador: 1234.5 -> 'R$ 1.234,50'.
const currencyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// Converte para número (Number(value) || 0 evita 'NaN' se vier algo inválido) e formata.
const formatMoney = (value) => currencyFormat.format(Number(value) || 0);
// Formata data/hora ISO no fuso da loja, no padrão brasileiro curto (ex.: 07/11/26 18:30).
const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: APP_CONFIG.timezone, dateStyle: 'short', timeStyle: 'short' });

// Dicionários código -> rótulo em português para exibir na tela.
const MOVEMENT_LABELS = { entry: 'Entrada', exit: 'Saída', adjustment: 'Ajuste' };
const STOCK_LABELS = { ok: 'Normal', low: 'Baixo', out: 'Esgotado' };

// Escapa caracteres especiais do HTML (& < > " '). ESSENCIAL: o painel monta HTML por concatenação de texto,
// então todo dado vindo do servidor/usuário precisa passar por aqui para evitar XSS (injeção de script).
// `value ?? ''` troca null/undefined por texto vazio.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Lê o preço digitado: aceita vírgula ou ponto ('129,90'), até 8 dígitos inteiros e 2 decimais. Devolve null se inválido.
function parsePrice(text) {
  const clean = String(text).trim().replace(',', '.');
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

// Lê um número inteiro digitado (só dígitos, até 9). Devolve null se inválido.
function parseWholeNumber(text) {
  const clean = String(text).trim();
  if (!/^\d{1,9}$/.test(clean)) return null;
  return Number(clean);
}

// Mostra uma mensagem temporária (toast) no canto da tela; some sozinha em 4,5 s. role=alert para erros e status para sucesso (leitores de tela).
function showToast(message, type = 'success') {
  const area = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
  area.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// Gera o HTML de uma 'etiqueta' colorida (ex.: Ativo, Esgotado). O estilo vem da classe badge-<tipo>.
function badge(text, kind) {
  return '<span class="badge badge-' + kind + '">' + escapeHtml(text) + '</span>';
}

// HTML padrão para listas vazias (título + dica).
function emptyState(title, hint) {
  return '<div class="empty"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(hint || '') + '</span></div>';
}

// Texto da quantidade com sinal: entrada '+10', saída '-3'. Para ajuste, o sinal depende de o saldo ter subido ou descido.
function movementSign(movement) {
  if (movement.type === 'entry') return '+' + movement.quantity;
  if (movement.type === 'exit') return '-' + movement.quantity;
  return movement.resulting_stock > movement.previous_stock ? '+' + movement.quantity : '-' + movement.quantity;
}

// Gera e baixa um arquivo CSV no navegador, sem servidor:
//  - '\uFEFF' (BOM) faz o Excel reconhecer UTF-8 e exibir acentos corretamente;
//  - separador ';' (padrão do Excel em português) e aspas duplas escapadas ("" dentro de campo);
//  - Blob + URL temporária + <a download> clicado por código.
function downloadCsv(filename, rows) {
  let content = '\uFEFF';
  for (const row of rows) {
    const cells = [];
    for (const cell of row) {
      cells.push('"' + String(cell ?? '').replace(/"/g, '""') + '"');
    }
    content += cells.join(';') + '\r\n';
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Tratamento GLOBAL de imagens quebradas: o evento 'error' não 'borbulha', por isso o 3º argumento `true` (fase de captura)
// captura erros de qualquer <img> da página e troca por FALLBACK_IMAGE. A checagem evita laço infinito se o próprio fallback falhar.
document.addEventListener(
  'error',
  (event) => {
    if (event.target.tagName === 'IMG' && event.target.src !== FALLBACK_IMAGE) {
      event.target.src = FALLBACK_IMAGE;
    }
  },
  true,
);

// Debounce: só executa `callback` depois de `delay` ms sem nova chamada. Usado na busca digitada, para não consultar
// a API a cada tecla pressionada.
const debounce = (callback, delay = 300) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
};

// Monta um campo de formulário: rótulo + controle + espaço <small> onde a mensagem de erro daquele campo (data-error-for) será exibida.
function fieldHtml(label, name, control) {
  return (
    '<label class="field"><span>' + escapeHtml(label) + '</span>' + control +
    '<small class="field-error" data-error-for="' + name + '"></small></label>'
  );
}
