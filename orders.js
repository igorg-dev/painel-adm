// admin-panel/js/orders.js — TELA "PEDIDOS"
// Lista todos os pedidos dos clientes (somente leitura), com busca por número/cliente, filtro de situação
// e janela de detalhes dos itens.

// Tela de pedidos (administrador).
class OrdersView extends View {
  async render() {
    try {
      // Carrega os pedidos (a API devolve até 50 por padrão, mais recentes primeiro).
      this.orders = await this.api.get('/admin/orders');
    } catch (error) {
      // 404 = módulo de pedidos ausente neste backend: mostra aviso. Outros erros sobem para a tela de erro padrão.
      if (error.status !== 404) throw error;
      this.root.innerHTML = emptyState('Módulo de pedidos indisponível', 'Não foi possível consultar os pedidos administrativos.');
      return;
    }
    this.root.innerHTML =
      '<div class="toolbar"><input type="search" id="order-search" placeholder="Buscar por nº do pedido ou cliente" aria-label="Buscar pedido">' +
      '<select id="order-status" aria-label="Situação"><option value="">Todas as situações</option><option value="Concluído">Concluído</option><option value="Cancelado">Cancelado</option></select></div>' +
      '<div class="panel table-wrap" id="order-table"></div>';
    this.root.querySelector('#order-search').addEventListener('input', () => this.renderRows());
    this.root.querySelector('#order-status').addEventListener('change', () => this.renderRows());
    this.bindClicks({ details: (data) => this.openDetails(Number(data.id)) });
    this.renderRows();
  }

  // Filtra NO NAVEGADOR: o texto casa com o número do pedido (aceita '#12') ou com nome/e-mail do cliente; o select filtra por situação.
  renderRows() {
    const text = this.root.querySelector('#order-search').value.trim().toLowerCase();
    const status = this.root.querySelector('#order-status').value;
    const box = this.root.querySelector('#order-table');
    let rows = '';
    let count = 0;
    for (const order of this.orders) {
      const customer = (order.user_name || '') + ' ' + (order.user_email || '');
      const matchesText = !text || String(order.id) === text.replace('#', '') || customer.toLowerCase().includes(text);
      if (!matchesText || (status && order.status !== status)) continue;
      count += 1;
      // Mostra o desconto com o percentual, ou '-' quando não houve.
      const discount = Number(order.discount) > 0 ? formatMoney(order.discount) + ' (' + Number(order.discount_percent) + '%)' : '-';
      rows +=
        '<tr><td><strong>#' + order.id + '</strong></td><td>' + formatDateTime(order.created_at) + '</td>' +
        '<td>' + escapeHtml(order.user_name || 'Cliente ' + order.user_id) + '</td>' +
        '<td class="num">' + formatMoney(order.subtotal) + '</td><td class="num">' + discount + '</td>' +
        '<td class="num"><strong>' + formatMoney(order.total) + '</strong></td>' +
        '<td>' + badge(order.status, order.status === 'Concluído' ? 'ok' : 'out') + '</td>' +
        '<td class="actions"><button class="btn btn-small" type="button" data-action="details" data-id="' + order.id + '">Ver itens</button></td></tr>';
    }
    box.innerHTML = count
      ? '<table><thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th class="num">Subtotal</th><th class="num">Desconto</th><th class="num">Total</th><th>Situação</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
      : emptyState('Nenhum pedido encontrado', 'Os pedidos confirmados pelos clientes aparecem aqui.');
  }

  // Abre o modal com os itens do pedido. Se a lista não trouxesse os itens, buscaria o pedido completo em /admin/orders/:id.
  async openDetails(id) {
    let order = this.orders.find((item) => item.id === id);
    try {
      if (!Array.isArray(order.items)) order = await this.api.get('/admin/orders/' + id);
    } catch (error) {
      showToast(error.message, 'error');
      return;
    }

    let lines = '';
    for (const item of order.items) {
      lines +=
        '<tr><td>' + escapeHtml(item.product_name) + '</td><td class="num">' + item.quantity + '</td>' +
        '<td class="num">' + formatMoney(item.unit_price) + '</td><td class="num">' + formatMoney(item.line_total) + '</td></tr>';
    }
    // Modal somente de leitura: sem `onSubmit`, o botão de confirmar fica oculto. Mostra os itens e o resumo (subtotal, desconto, total).
    this.modal.open({
      title: 'Pedido #' + order.id,
      body:
        '<p class="modal-lead">' + escapeHtml(order.user_name || 'Cliente ' + order.user_id) + ' · ' + formatDateTime(order.created_at) + ' · ' + escapeHtml(order.status) + '</p>' +
        '<table><thead><tr><th>Produto</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead><tbody>' + lines + '</tbody></table>' +
        '<dl class="sum"><div><dt>Subtotal</dt><dd>' + formatMoney(order.subtotal) + '</dd></div>' +
        '<div><dt>Desconto (' + Number(order.discount_percent) + '%)</dt><dd>-' + formatMoney(order.discount) + '</dd></div>' +
        '<div class="sum-total"><dt>Total</dt><dd>' + formatMoney(order.total) + '</dd></div></dl>',
    });
  }
}
