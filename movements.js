// admin-panel/js/movements.js — TELA "HISTÓRICO DE MOVIMENTAÇÕES"
// Trilha de auditoria do estoque: filtros por produto, tipo e período, paginação ("Carregar mais")
// e exportação para CSV.

// Tela de histórico.
class MovementsView extends View {
  async render() {
    // Carrega os produtos (inclusive inativos) para o filtro por produto.
    const products = await this.api.get('/products', { include_inactive: 'true' });
    let options = '<option value="">Todos os produtos</option>';
    for (const product of products) {
      options += '<option value="' + product.id + '">' + escapeHtml(product.code + ' - ' + product.name) + '</option>';
    }

    this.root.innerHTML =
      '<div class="toolbar"><select id="mv-product" aria-label="Produto">' + options + '</select>' +
      '<select id="mv-type" aria-label="Tipo"><option value="">Todos os tipos</option><option value="entry">Entrada</option><option value="exit">Saída</option><option value="adjustment">Ajuste</option></select>' +
      '<label class="inline">De <input type="date" id="mv-from"></label><label class="inline">Até <input type="date" id="mv-to"></label>' +
      '<button class="btn push" type="button" data-action="export">Exportar CSV</button></div>' +
      '<div class="panel table-wrap" id="mv-table"></div>' +
      '<div class="more"><button class="btn" type="button" id="mv-more" data-action="more" hidden>Carregar mais</button></div>';

    // Qualquer mudança de filtro recarrega a lista desde o início.
    for (const id of ['#mv-product', '#mv-type', '#mv-from', '#mv-to']) {
      this.root.querySelector(id).addEventListener('change', () => this.reload());
    }
    this.bindClicks({
      more: () => this.loadPage(),
      export: () => this.exportCsv(),
    });
    // Primeira carga: `true` faz o erro subir para View.show() (tela de erro com 'Tentar novamente').
    await this.reload(true);
  }

  // Lê os filtros atuais da tela (valores vazios são ignorados pelo ApiClient). As datas <input type=date> enviam AAAA-MM-DD.
  currentFilters() {
    return {
      product_id: this.root.querySelector('#mv-product').value,
      type: this.root.querySelector('#mv-type').value,
      from: this.root.querySelector('#mv-from').value,
      to: this.root.querySelector('#mv-to').value,
    };
  }

  // Zera a lista e o deslocamento (offset) e carrega a primeira página.
  async reload(throwErrors = false) {
    this.rows = [];
    this.offset = 0;
    try {
      await this.loadPage();
    } catch (error) {
      if (throwErrors) throw error;
      showToast(error.message, 'error');
    }
  }

  // PAGINAÇÃO: pede `limit` itens a partir de `offset` e acrescenta ao final da lista; avança o offset.
  async loadPage() {
    const page = await this.api.get('/stock/movements', {
      ...this.currentFilters(),
      limit: MOVEMENT_PAGE_SIZE,
      offset: this.offset,
    });
    this.rows.push(...page);
    this.offset += MOVEMENT_PAGE_SIZE;
    // Se veio menos que uma página cheia, acabaram os registros: esconde 'Carregar mais'.
    this.root.querySelector('#mv-more').hidden = page.length < MOVEMENT_PAGE_SIZE;
    this.renderTable();
  }

  // Desenha a tabela (data, produto, tipo, quantidade com sinal, saldo anterior -> resultante, motivo e responsável).
  renderTable() {
    const box = this.root.querySelector('#mv-table');
    if (this.rows.length === 0) {
      box.innerHTML = emptyState('Nenhuma movimentação', 'Não há registros para os filtros escolhidos.');
      return;
    }
    let body = '';
    for (const move of this.rows) {
      const origin = move.order_id ? ' ' + badge('Pedido #' + move.order_id, 'off') : '';
      body +=
        '<tr><td>' + formatDateTime(move.created_at) + '</td>' +
        '<td><strong>' + escapeHtml(move.product_name) + '</strong><br><small>' + escapeHtml(move.product_code) + '</small></td>' +
        '<td>' + badge(MOVEMENT_LABELS[move.type], move.type) + '</td><td class="num"><strong>' + movementSign(move) + '</strong></td>' +
        '<td class="num">' + move.previous_stock + ' → ' + move.resulting_stock + '</td>' +
        '<td>' + escapeHtml(move.reason || '-') + origin + '</td><td>' + escapeHtml(move.user_name || '-') + '</td></tr>';
    }
    box.innerHTML =
      '<table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="num">Qtd.</th><th class="num">Saldo</th><th>Motivo</th><th>Responsável</th></tr></thead><tbody>' +
      body + '</tbody></table>';
  }

  // Para exportar: baixa TODAS as páginas (de 500 em 500) respeitando os filtros, com limite de segurança de páginas.
  async fetchAll(filters) {
    const all = [];
    let offset = 0;
    let pages = 0;
    let hasMore = true;
    while (hasMore && pages < EXPORT_MAX_PAGES) {
      const page = await this.api.get('/stock/movements', { ...filters, limit: EXPORT_PAGE_SIZE, offset });
      all.push(...page);
      offset += EXPORT_PAGE_SIZE;
      // Página cheia = pode haver mais; página parcial = fim.
      hasMore = page.length === EXPORT_PAGE_SIZE;
      pages += 1;
    }
    return all;
  }

  // Monta as linhas (cabeçalho + dados) e dispara o download com downloadCsv().
  async exportCsv() {
    try {
      const movements = await this.fetchAll(this.currentFilters());
      if (movements.length === 0) {
        showToast('Não há movimentações para exportar.', 'error');
        return;
      }
      const rows = [['Data', 'Código', 'Produto', 'Tipo', 'Quantidade', 'Saldo anterior', 'Saldo resultante', 'Motivo', 'Pedido', 'Responsável']];
      for (const move of movements) {
        rows.push([
          formatDateTime(move.created_at), move.product_code, move.product_name, MOVEMENT_LABELS[move.type],
          movementSign(move), move.previous_stock, move.resulting_stock, move.reason, move.order_id, move.user_name,
        ]);
      }
      downloadCsv('movimentacoes-estoque.csv', rows);
      showToast(movements.length + ' movimentações exportadas.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}
