// admin-panel/js/base.js — CLASSES-BASE DA INTERFACE
//
//  - Modal : controla a janela de diálogo reutilizável (formulários e confirmações);
//  - View  : classe-mãe de todas as telas do painel (Dashboard, Produtos, Categorias...).
// Cada tela herda de View e implementa apenas `render()`.

// Encapsula o elemento nativo <dialog id='modal'> do index.html.
class Modal {
  constructor() {
    // Guarda referências aos elementos do DOM uma única vez.
    this.dialog = document.getElementById('modal');
    this.form = document.getElementById('modal-form');
    this.title = document.getElementById('modal-title');
    this.body = document.getElementById('modal-body');
    this.error = document.getElementById('modal-error');
    this.submit = document.getElementById('modal-submit');
    // Função a executar quando o formulário do modal for enviado (muda a cada abertura).
    this.handler = null;

    // Intercepta o envio do formulário.
    this.form.addEventListener('submit', (event) => this.handleSubmit(event));
    // Fecha ao clicar em qualquer elemento [data-close] (botão X, Cancelar) ou no fundo escurecido (o clique cai no próprio <dialog>).
    this.dialog.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]') || event.target === this.dialog) this.close();
    });
  }

  // Abre o modal. `body` é HTML do conteúdo; `onSubmit` é a ação de confirmar; `danger` pinta o botão de vermelho (ações destrutivas).
  open({ title, body, submitLabel = 'Salvar', danger = false, onSubmit = null }) {
    this.title.textContent = title;
    this.body.innerHTML = body;
    this.handler = onSubmit;
    // Sem onSubmit (ex.: modal só de visualização) o botão de confirmar fica oculto.
    this.submit.hidden = !onSubmit;
    this.submit.textContent = submitLabel;
    this.submit.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    this.clearErrors();
    // API nativa: abre como modal (bloqueia o resto da página e gerencia o foco).
    this.dialog.showModal();
    // Acessibilidade/usabilidade: foca o primeiro campo editável.
    const firstField = this.body.querySelector('input:not([disabled]), select');
    if (firstField) firstField.focus();
  }

  // Fecha e descarta o handler.
  close() {
    this.dialog.close();
    this.handler = null;
  }

  // Limpa a mensagem geral e as mensagens de cada campo.
  clearErrors() {
    this.error.hidden = true;
    this.error.textContent = '';
    for (const slot of this.form.querySelectorAll('[data-error-for]')) {
      slot.textContent = '';
    }
  }

  // Fluxo do envio: evita recarregar a página -> limpa erros -> desabilita o botão (evita duplo clique) -> executa o handler -> fecha se deu certo, mostra erro se falhou -> reabilita o botão.
  async handleSubmit(event) {
    event.preventDefault();
    if (!this.handler) return;
    this.clearErrors();
    this.submit.disabled = true;
    try {
      await this.handler(this.form);
      this.close();
    } catch (error) {
      this.showError(error);
    } finally {
      this.submit.disabled = false;
    }
  }

  // Mostra cada erro de campo no espaço correspondente (data-error-for = nome do campo) e a mensagem geral no topo do rodapé.
  showError(error) {
    for (const item of error.errors || []) {
      const slot = this.form.querySelector('[data-error-for="' + item.field + '"]');
      if (slot) slot.textContent = item.message;
    }
    this.error.textContent = error.message || 'Não foi possível concluir a operação.';
    this.error.hidden = false;
  }
}

// Classe-mãe das telas.
class View {
  constructor(app) {
    this.app = app;
    this.api = app.api;
    this.modal = app.modal;
    this.root = document.getElementById('view');
  }

  // Ciclo padrão de uma tela: mostra 'Carregando…', chama render() (implementado pela subclasse) e, se falhar, mostra o erro com botão 'Tentar novamente'.
  async show() {
    // Remove manipuladores de clique da tela anterior.
    this.root.onclick = null;
    this.root.innerHTML = '<p class="loading">Carregando…</p>';
    try {
      await this.render();
    } catch (error) {
      this.renderError(error);
    }
  }

  // Tela de erro: título conforme o status (403 acesso negado, 0 servidor indisponível).
  renderError(error) {
    let title = 'Não foi possível carregar';
    if (error.status === 403) title = 'Acesso negado';
    if (error.status === 0) title = 'Servidor indisponível';
    this.root.innerHTML =
      '<div class="empty is-error">' + '<strong>' + title + '</strong><span>' + escapeHtml(error.message) +
      '</span><button class="btn" type="button" data-action="retry">Tentar novamente</button></div>';
    this.root.onclick = (event) => {
      if (event.target.closest('[data-action="retry"]')) this.show();
    };
  }

  // DELEGAÇÃO DE EVENTOS: em vez de um listener por botão, há UM listener na área da tela. Os botões trazem
  // data-action="nome" e atributos data-*; ao clicar, procura o botão mais próximo com data-action e chama a função correspondente
  // do objeto `handlers`, passando os data-* (target.dataset). Funciona mesmo com botões criados depois.
  bindClicks(handlers) {
    this.root.onclick = (event) => {
      const target = event.target.closest('[data-action]');
      if (!target || !handlers[target.dataset.action]) return;
      handlers[target.dataset.action](target.dataset);
    };
  }

  // Atalho para diálogos de confirmação de ações destrutivas (botão vermelho).
  confirm({ title, message, label, onConfirm }) {
    this.modal.open({
      title,
      body: '<p class="modal-lead">' + message + '</p>',
      submitLabel: label,
      danger: true,
      onSubmit: onConfirm,
    });
  }
}
