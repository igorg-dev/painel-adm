// admin-panel/js/dashboard.js — TELA "VISÃO GERAL"
// Mostra 4 indicadores, a lista de produtos que precisam de reposição e as últimas movimentações.

// Herda de View: só precisa implementar render().
class DashboardView extends View {
  async render() {
    // Promise.all dispara as 5 requisições AO MESMO TEMPO (mais rápido que uma após a outra) e espera todas.
    const [summary, orders, low, out, movements] = await Promise.all([
      this.api.get('/stock/summary'),
      // Se o resumo de pedidos falhar, vira null e o painel continua (mostra '—') em vez de quebrar a tela inteira.
      this.api.get('/admin/orders/summary').catch(() => null),
      this.api.get('/stock', { status: 'low' }),
      this.api.get('/stock', { status: 'out' }),
      this.api.get('/stock/movements', { limit: 6 }),
    ]);

    // Mantém o limite de estoque baixo sincronizado com o servidor.
    this.app.threshold = summary.low_stock_threshold;
    // Total de pedidos ou '—' se indisponível.
    const ordersCount = orders ? orders.total_orders : '—';
    // Produtos esgotados + baixos, só os ativos (esgotados primeiro).
    const needRestock = [...out, ...low].filter((item) => item.active);

    // Monta o HTML da lista de reposição concatenando texto. Todo dado externo passa por escapeHtml.
    let restockRows = '';
    for (const item of needRestock) {
      restockRows +=
        '<li><div><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.code) + '</span></div>' +
        '<div class="row-end">' + badge(item.stock + ' un.', item.status) +
        '<button class="btn btn-small" type="button" data-action="restock" data-id="' + item.id + '">Repor</button></div></li>';
    }

    // Monta o HTML das últimas movimentações.
    let movementRows = '';
    for (const move of movements) {
      movementRows +=
        '<li><div><strong>' + escapeHtml(move.product_name) + '</strong><span>' + formatDateTime(move.created_at) + '</span></div>' +
        '<div class="row-end">' + badge(MOVEMENT_LABELS[move.type], move.type) +
        '<b class="num">' + movementSign(move) + '</b></div></li>';
    }

    // Desenha a tela de uma vez: cartões de indicadores + duas listas.
    this.root.innerHTML =
      '<div class="stats">' +
      this.statTile('Produtos ativos', summary.active_products, 'de ' + summary.total_products + ' cadastrados', '') +
      this.statTile('Estoque baixo', summary.low_stock, 'até ' + summary.low_stock_threshold + ' unidades', summary.low_stock ? 'warn' : '') +
      this.statTile('Esgotados', summary.out_of_stock, 'sem saldo para venda', summary.out_of_stock ? 'bad' : '') +
      this.statTile('Pedidos registrados', ordersCount, 'de todos os clientes', '') +
      '</div><div class="split">' +
      '<section class="panel"><h2>Precisam de reposição</h2>' +
      (restockRows ? '<ul class="list">' + restockRows + '</ul>' : emptyState('Estoque em dia', 'Nenhum produto ativo abaixo do mínimo.')) +
      '</section><section class="panel"><h2>Últimas movimentações</h2>' +
      (movementRows ? '<ul class="list">' + movementRows + '</ul>' : emptyState('Sem movimentações', 'O histórico aparece aqui.')) +
      '<a class="link" href="#movements">Ver histórico completo</a></section></div>';

    // Botão 'Repor' (data-action='restock'): abre o modal de ENTRADA para o produto escolhido; ao concluir, recarrega a tela.
    this.bindClicks({
      restock: (data) => {
        const product = needRestock.find((item) => item.id === Number(data.id));
        this.app.openMovement(product, 'entry', () => this.show());
      },
    });
  }

  // Gera um cartão de indicador. `tone` ('warn' ou 'bad') colore a borda quando há alerta.
  statTile(label, value, hint, tone) {
    return (
      '<div class="stat ' + tone + '"><span>' + escapeHtml(label) + '</span><strong>' + value + '</strong><small>' +
      escapeHtml(hint) + '</small></div>'
    );
  }
}
