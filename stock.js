// admin-panel/js/stock.js — TELA "ESTOQUE"
// Saldos por produto com barra de nível e botões Entrada / Saída / Ajuste.
// Diferente da tela de Produtos, aqui os filtros são feitos NO SERVIDOR (parâmetros status e search da API).

// Tela de estoque.
class StockView extends View {
  async render() {
    this.root.innerHTML =
      '<div class="toolbar"><input type="search" id="stock-search" placeholder="Buscar por nome ou código" aria-label="Buscar produto">' +
      '<select id="stock-status" aria-label="Situação do saldo"><option value="">Todos os saldos</option><option value="ok">Normal</option><option value="low">Baixo</option><option value="out">Esgotado</option></select></div>' +
      '<div class="panel table-wrap" id="stock-table"></div>';

    // Recarrega só a tabela; erros viram toast (não derrubam a tela).
    const reload = () => this.loadTable().catch((error) => showToast(error.message, 'error'));
    // Busca digitada com debounce: espera uma pausa na digitação para consultar a API.
    this.root.querySelector('#stock-search').addEventListener('input', debounce(reload));
    this.root.querySelector('#stock-status').addEventListener('change', reload);

    this.bindClicks({
      // Botões Entrada/Saída/Ajuste (data-type diz qual); abre o modal compartilhado do App e recarrega a tabela depois.
      move: (data) => {
        const product = this.balances.find((item) => item.id === Number(data.id));
        this.app.openMovement(product, data.type, () => this.loadTable());
      },
    });
    await this.loadTable();
  }

  // Busca os saldos filtrados na API e desenha a tabela.
  async loadTable() {
    this.balances = await this.api.get('/stock', {
      status: this.root.querySelector('#stock-status').value,
      search: this.root.querySelector('#stock-search').value.trim(),
    });
    const box = this.root.querySelector('#stock-table');
    if (this.balances.length === 0) {
      box.innerHTML = emptyState('Nenhum produto encontrado', 'Tente outro nome ou outra situação de saldo.');
      return;
    }

    // Maior saldo da lista (mínimo = 2x o limite): serve de 100% para a barra de nível, mantendo as barras proporcionais.
    let highest = this.app.threshold * 2;
    for (const item of this.balances) {
      if (item.stock > highest) highest = item.stock;
    }

    let rows = '';
    for (const item of this.balances) {
      // Largura da barra em %: saldo / maior saldo, limitada a 100.
      const width = Math.min(100, Math.round((item.stock / highest) * 100));
      rows +=
        '<tr class="' + (item.active ? '' : 'is-muted') + '"><td>' + escapeHtml(item.code) + '</td>' +
        '<td><strong>' + escapeHtml(item.name) + '</strong>' + (item.active ? '' : ' ' + badge('Inativo', 'off')) + '</td>' +
        '<td>' + escapeHtml(item.category_name) + '</td>' +
        // Barra de nível colorida conforme a situação (level-ok / level-low / level-out).
        '<td><div class="level" role="img" aria-label="Nível de estoque"><i class="level-' + item.status + '" style="width:' + width + '%"></i></div></td>' +
        '<td class="num"><strong>' + item.stock + '</strong></td><td>' + badge(STOCK_LABELS[item.status], item.status) + '</td>' +
        '<td class="actions">' +
        '<button class="btn btn-small" type="button" data-action="move" data-type="entry" data-id="' + item.id + '">Entrada</button>' +
        '<button class="btn btn-small" type="button" data-action="move" data-type="exit" data-id="' + item.id + '">Saída</button>' +
        '<button class="btn btn-small" type="button" data-action="move" data-type="adjustment" data-id="' + item.id + '">Ajuste</button></td></tr>';
    }
    box.innerHTML =
      '<table><thead><tr><th>Código</th><th>Produto</th><th>Categoria</th><th>Nível</th><th class="num">Saldo</th><th>Situação</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
  }
}
