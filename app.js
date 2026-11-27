// admin-panel/js/app.js — APLICAÇÃO PRINCIPAL DO PAINEL (último script carregado)
//
// Responsável por: login/logout, validar a sessão ao abrir, navegação entre telas por hash (#products),
// e pelo modal de movimentação de estoque compartilhado por duas telas.
// A última linha do arquivo (`new App().start()`) é o que faz tudo começar.

// Classe que reúne o estado e o comportamento global do painel.
class App {
  constructor() {
    // Dependências criadas uma vez e compartilhadas com as telas (via `app`).
    this.session = new SessionManager();
    this.api = new ApiClient(API_URL, this.session);
    this.modal = new Modal();
    // Limite de estoque baixo; é atualizado com o valor real vindo do backend.
    this.threshold = 5;
    // TABELA DE ROTAS: nome do hash na URL -> título da página + classe da tela. Para criar uma tela nova: nova classe View + uma linha aqui + um link no menu.
    this.routes = {
      dashboard: { title: 'Visão geral', View: DashboardView },
      products: { title: 'Produtos', View: ProductsView },
      categories: { title: 'Categorias', View: CategoriesView },
      stock: { title: 'Estoque', View: StockView },
      movements: { title: 'Histórico de movimentações', View: MovementsView },
      orders: { title: 'Pedidos', View: OrdersView },
    };
    // Se qualquer chamada receber 401, faz logout com aviso.
    this.api.onUnauthorized = () => this.logout('Sua sessão expirou. Entre novamente.');
  }

  // Inicialização.
  async start() {
    // Registra os eventos: envio do login, botão Sair e mudança do #hash da URL (navegação).
    document.getElementById('login-form').addEventListener('submit', (event) => this.handleLogin(event));
    document.getElementById('logout').addEventListener('click', () => this.logout());
    window.addEventListener('hashchange', () => this.route());

    // Sem token guardado: mostra o login.
    if (!this.session.getToken()) {
      this.showLogin();
      return;
    }

    try {
      // Há token: pergunta ao backend quem é o usuário (valida token e expiração). Não basta confiar no localStorage, que o usuário poderia editar.
      const response = await this.api.get('/auth/me');
      // Logado, mas não é administrador (ex.: um cliente): limpa a sessão e nega acesso.
      if (!response.user || response.user.role !== 'admin') {
        this.session.clear();
        this.showLogin('Esta área é restrita a administradores.');
        return;
      }
      this.session.save(this.session.getToken(), response.user);
      // Tudo certo: abre o painel.
      await this.showPanel();
    } catch (error) {
      // Token inválido/expirado: limpa. Em outros erros (ex.: servidor offline) o token é mantido para tentar de novo depois.
      if (error.status === 401) this.session.clear();
      this.showLogin(error.status === 0
        ? 'Não foi possível validar a sessão. Verifique se o servidor está em execução.'
        : (error.message || 'Sua sessão não é válida. Entre novamente.'));
    }
  }

  // Exibe a tela de login (e oculta o painel) com mensagem opcional.
  showLogin(message = '') {
    document.getElementById('panel').hidden = true;
    document.getElementById('login').hidden = false;
    const error = document.getElementById('login-error');
    error.textContent = message;
    error.hidden = !message;
  }

  // Fluxo do login do administrador.
  async handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const error = document.getElementById('login-error');
    const button = form.querySelector('button');
    error.hidden = true;

    // Validação rápida no navegador (a validação definitiva é do backend).
    if (!/^\S+@\S+\.\S+$/.test(email) || password === '') {
      error.textContent = 'Informe um e-mail válido e a senha.';
      error.hidden = false;
      return;
    }

    button.disabled = true;
    try {
      // Chama a API. Mesmo que um cliente comum acerte a senha, esta tela só aceita quem tem papel 'admin'.
      const data = await this.api.post('/auth/login', { email, password });
      if (!data.user || data.user.role !== 'admin') {
        throw new ApiError(403, 'Esta área é restrita a administradores.');
      }
      // Guarda o token para as próximas chamadas.
      this.session.save(data.token, data.user);
      form.reset();
      this.showPanel();
    } catch (err) {
      // 401 no login = e-mail/senha incorretos.
      error.textContent = err.status === 401 ? 'E-mail ou senha incorretos.' : err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  // Exibe o painel, mostra o nome do admin e carrega o limite de estoque baixo configurado no servidor.
  async showPanel() {
    document.getElementById('login').hidden = true;
    document.getElementById('panel').hidden = false;
    document.getElementById('user-name').textContent = this.session.getUser().name;
    try {
      const summary = await this.api.get('/stock/summary');
      this.threshold = summary.low_stock_threshold;
    } catch (error) {
      this.threshold = 5;
    }
    this.route();
  }

  // ROTEADOR: lê o #hash (ex.: #stock); se não existir, usa 'dashboard'. Destaca o item de menu ativo, atualiza o título e instancia a tela correspondente.
  route() {
    if (!this.session.isAdmin()) return;
    const key = location.hash.slice(1);
    const name = this.routes[key] ? key : 'dashboard';
    const route = this.routes[name];
    for (const link of document.querySelectorAll('[data-route]')) {
      const active = link.dataset.route === name;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.getElementById('page-title').textContent = route.title;
    document.title = route.title + ' - ecommerce-web';
    // Cria a tela (passando o App) e a exibe. Cada navegação cria uma instância nova, sempre com dados atualizados.
    new route.View(this).show();
  }

  // Encerra a sessão local, fecha modal aberto e volta ao login.
  logout(message = '') {
    this.session.clear();
    if (this.modal.dialog.open) this.modal.close();
    this.showLogin(message);
  }

  // Modal reutilizado para ENTRADA, SAÍDA e AJUSTE de estoque (chamado pelas telas Visão geral e Estoque).
  // `onDone` é a função que recarrega a tela depois do sucesso.
  openMovement(product, type, onDone) {
    // Cada tipo de movimentação usa um endpoint da API diferente.
    const endpoints = { entry: '/stock/entries', exit: '/stock/exits', adjustment: '/stock/adjustments' };
    const titles = { entry: 'Registrar entrada', exit: 'Registrar saída', adjustment: 'Ajustar estoque' };
    const adjusting = type === 'adjustment';
    // No ajuste o campo é o 'novo saldo contado'; nos demais, a 'quantidade'.
    const control = adjusting
      ? fieldHtml('Novo saldo contado', 'new_stock', '<input name="new_stock" inputmode="numeric" autocomplete="off">')
      : fieldHtml('Quantidade', 'quantity', '<input name="quantity" inputmode="numeric" autocomplete="off">');
    const reasonLabel = type === 'entry' ? 'Motivo (opcional)' : 'Motivo';

    this.modal.open({
      title: titles[type],
      submitLabel: 'Confirmar',
      body:
        '<p class="modal-lead"><strong>' + escapeHtml(product.name) + '</strong><br>Saldo atual: <b>' + product.stock + '</b></p>' +
        control + fieldHtml(reasonLabel, 'reason', '<input name="reason" maxlength="255" autocomplete="off">'),
      // Ao confirmar: lê os campos, valida NO NAVEGADOR (resposta imediata) e só então chama a API. Os erros viram ApiError(400) com lista por campo, exibida pelo Modal.
      onSubmit: async (form) => {
        const data = new FormData(form);
        const reason = String(data.get('reason')).trim();
        const errors = [];
        const payload = { product_id: product.id };

        // Regras do ajuste: número inteiro >= 0 e diferente do saldo atual.
        if (adjusting) {
          payload.new_stock = parseWholeNumber(data.get('new_stock'));
          if (payload.new_stock === null) errors.push({ field: 'new_stock', message: 'Informe um número inteiro, 0 ou maior.' });
          else if (payload.new_stock === product.stock) errors.push({ field: 'new_stock', message: 'O novo saldo é igual ao saldo atual.' });
        } else {
          payload.quantity = parseWholeNumber(data.get('quantity'));
          if (payload.quantity === null || payload.quantity < 1) errors.push({ field: 'quantity', message: 'Informe um número inteiro maior que zero.' });
          // Saída não pode exceder o saldo (o backend também valida).
          else if (type === 'exit' && payload.quantity > product.stock) errors.push({ field: 'quantity', message: 'A saída não pode ser maior que o saldo atual (' + product.stock + ').' });
        }
        // Saída e ajuste exigem motivo (como no backend e no banco).
        if (type !== 'entry' && !reason) errors.push({ field: 'reason', message: 'Informe o motivo da movimentação.' });
        if (reason) payload.reason = reason;
        if (errors.length > 0) throw new ApiError(400, 'Revise os campos destacados.', errors);

        // Envia a movimentação. Se a API recusar, o erro sobe ao Modal.handleSubmit e aparece no formulário.
        await this.api.post(endpoints[type], payload);
        showToast('Movimentação registrada com sucesso.');
        await onDone();
      },
    });
  }
}

// PONTO DE PARTIDA: cria a aplicação e a inicia.
new App().start();
