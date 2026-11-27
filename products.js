// admin-panel/js/products.js — TELA "PRODUTOS"
// Tabela com busca e filtros (feitos NO NAVEGADOR sobre a lista já carregada), cadastro, edição,
// desativação e reativação.

// Tela de produtos.
class ProductsView extends View {
  async render() {
    // Carrega produtos e categorias em paralelo (inclui inativos).
    const [products, categories] = await Promise.all([
      this.api.get('/products', { include_inactive: 'true' }),
      this.api.get('/categories', { include_inactive: 'true' }),
    ]);
    // Converte cada item em objeto Product (ganha o método stockStatus).
    this.products = products.map((item) => new Product(item));
    this.categories = categories;

    // Opções do filtro de categoria.
    let filterOptions = '<option value="">Todas as categorias</option>';
    for (const category of categories) {
      filterOptions += '<option value="' + category.id + '">' + escapeHtml(category.name) + '</option>';
    }

    this.root.innerHTML =
      '<div class="toolbar"><input type="search" id="product-search" placeholder="Buscar por nome ou código" aria-label="Buscar produto">' +
      '<select id="product-category" aria-label="Categoria">' + filterOptions + '</select>' +
      '<select id="product-status" aria-label="Situação"><option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select>' +
      '<button class="btn btn-primary push" type="button" data-action="create">Novo produto</button></div>' +
      '<div class="panel table-wrap" id="product-table"></div>';

    // Filtros e busca só redesenham a tabela localmente, sem nova requisição (a lista já está em memória).
    const redraw = () => this.renderRows();
    this.root.querySelector('#product-search').addEventListener('input', redraw);
    this.root.querySelector('#product-category').addEventListener('change', redraw);
    this.root.querySelector('#product-status').addEventListener('change', redraw);

    // Ações dos botões: criar, editar, desativar, reativar.
    this.bindClicks({
      create: () => this.openForm(null),
      edit: (data) => this.openForm(this.findProduct(data.id)),
      deactivate: (data) => this.askDeactivate(this.findProduct(data.id)),
      activate: (data) => this.activate(this.findProduct(data.id)),
    });
    this.renderRows();
  }

  findProduct(id) {
    return this.products.find((item) => item.id === Number(id));
  }

  // Aplica busca (nome ou código), categoria e situação (ativo/inativo) sobre a lista.
  filteredProducts() {
    const text = this.root.querySelector('#product-search').value.trim().toLowerCase();
    const category = this.root.querySelector('#product-category').value;
    const status = this.root.querySelector('#product-status').value;
    return this.products.filter((product) => {
      const matchesText = !text || product.name.toLowerCase().includes(text) || product.code.toLowerCase().includes(text);
      const matchesCategory = !category || product.category_id === Number(category);
      const matchesStatus = !status || (status === 'active') === product.active;
      return matchesText && matchesCategory && matchesStatus;
    });
  }

  // Desenha as linhas da tabela conforme os filtros.
  renderRows() {
    const list = this.filteredProducts();
    const box = this.root.querySelector('#product-table');
    if (list.length === 0) {
      box.innerHTML = emptyState('Nenhum produto encontrado', 'Ajuste a busca ou os filtros, ou cadastre um novo produto.');
      return;
    }
    let rows = '';
    for (const product of list) {
      // Situação do saldo (ok/low/out) para a etiqueta colorida.
      const level = product.stockStatus(this.app.threshold);
      const toggle = product.active
        ? '<button class="btn btn-small btn-quiet" type="button" data-action="deactivate" data-id="' + product.id + '">Desativar</button>'
        : '<button class="btn btn-small btn-quiet" type="button" data-action="activate" data-id="' + product.id + '">Reativar</button>';
      rows +=
        '<tr class="' + (product.active ? '' : 'is-muted') + '">' +
        '<td><img class="thumb" src="' + escapeHtml(product.image_url || FALLBACK_IMAGE) + '" alt="" loading="lazy"></td>' +
        '<td>' + escapeHtml(product.code) + '</td><td><strong>' + escapeHtml(product.name) + '</strong></td>' +
        '<td>' + escapeHtml(product.category_name) + '</td><td class="num">' + formatMoney(product.price) + '</td>' +
        '<td class="num">' + product.stock + ' ' + badge(STOCK_LABELS[level], level) + '</td>' +
        '<td>' + badge(product.active ? 'Ativo' : 'Inativo', product.active ? 'ok' : 'off') + '</td>' +
        '<td class="actions"><button class="btn btn-small" type="button" data-action="edit" data-id="' + product.id + '">Editar</button>' + toggle + '</td></tr>';
    }
    box.innerHTML =
      '<table><thead><tr><th></th><th>Código</th><th>Produto</th><th>Categoria</th><th class="num">Preço</th><th class="num">Estoque</th><th>Situação</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>';
  }

  // Abre o modal de cadastro (product = null) ou edição.
  openForm(product) {
    const editing = product !== null;
    let options = '';
    for (const category of this.categories) {
      // Categorias inativas não aparecem para escolha, exceto a que o produto já usa (para não quebrar a edição).
      if (!category.active && !(editing && category.id === product.category_id)) continue;
      const selected = editing && category.id === product.category_id ? ' selected' : '';
      options += '<option value="' + category.id + '"' + selected + '>' + escapeHtml(category.name) + '</option>';
    }
    // Auxiliar: valor atual do campo, já escapado, ou texto vazio.
    const value = (key) => (editing && product[key] !== null ? escapeHtml(product[key]) : '');
    // Na EDIÇÃO aparece a caixa 'ativo'; no CADASTRO aparece 'Estoque inicial' (o saldo só muda depois por movimentações).
    const extra = editing
      ? '<label class="check"><input type="checkbox" name="active"' + (product.active ? ' checked' : '') + '> Produto ativo na loja</label>'
      : fieldHtml('Estoque inicial', 'stock', '<input name="stock" inputmode="numeric" value="0">');

    this.modal.open({
      title: editing ? 'Editar produto' : 'Novo produto',
      submitLabel: editing ? 'Salvar alterações' : 'Cadastrar produto',
      body:
        '<div class="grid-2">' + fieldHtml('Código', 'code', '<input name="code" maxlength="30" value="' + value('code') + '">') +
        fieldHtml('Categoria', 'category_id', '<select name="category_id"><option value="">Selecione</option>' + options + '</select>') + '</div>' +
        fieldHtml('Nome', 'name', '<input name="name" maxlength="150" value="' + value('name') + '">') +
        '<div class="grid-2">' + fieldHtml('Preço (R$)', 'price', '<input name="price" inputmode="decimal" value="' + (editing ? String(product.price).replace('.', ',') : '') + '">') +
        extra + '</div>' +
        fieldHtml('Endereço da imagem', 'image_url', '<input name="image_url" maxlength="500" value="' + value('image_url') + '">'),
      // Valida (readForm) e envia: PUT para editar, POST para cadastrar; depois recarrega a tela.
      onSubmit: async (form) => {
        const payload = this.readForm(form, editing);
        if (editing) {
          await this.api.put('/products/' + product.id, payload);
          showToast('Produto atualizado com sucesso.');
        } else {
          await this.api.post('/products', payload);
          showToast('Produto cadastrado com sucesso.');
        }
        await this.show();
      },
    });
  }

  // Lê e valida o formulário NO NAVEGADOR, acumulando erros por campo (a validação oficial continua no backend).
  readForm(form, editing) {
    const data = new FormData(form);
    const errors = [];
    const code = String(data.get('code')).trim();
    const name = String(data.get('name')).trim();
    const categoryId = parseWholeNumber(data.get('category_id'));
    // Converte '129,90' em 129.9 (ou null se inválido).
    const price = parsePrice(data.get('price'));
    const image = String(data.get('image_url')).trim();

    if (!code) errors.push({ field: 'code', message: 'Informe o código.' });
    if (!name) errors.push({ field: 'name', message: 'Informe o nome.' });
    if (categoryId === null) errors.push({ field: 'category_id', message: 'Escolha uma categoria.' });
    if (price === null) errors.push({ field: 'price', message: 'Use um valor como 129,90 (até 2 casas decimais).' });
    // Imagem opcional, mas se informada precisa ser uma URL http(s).
    if (image && !/^https?:\/\//i.test(image)) errors.push({ field: 'image_url', message: 'Use um endereço começando com http:// ou https://.' });

    // Corpo enviado à API; imagem vazia vira null (remove a imagem).
    const payload = { code, name, category_id: categoryId, price, image_url: image || null };
    if (editing) {
      payload.active = data.get('active') === 'on';
    } else {
      const stock = parseWholeNumber(data.get('stock'));
      if (stock === null) errors.push({ field: 'stock', message: 'Informe um número inteiro, 0 ou maior.' });
      payload.stock = stock;
    }
    if (errors.length > 0) throw new ApiError(400, 'Revise os campos destacados.', errors);
    return payload;
  }

  // Confirmação: o produto sai da loja, mas pedidos e movimentações antigos permanecem.
  askDeactivate(product) {
    this.confirm({
      title: 'Desativar produto',
      message: '<strong>' + escapeHtml(product.name) + '</strong> deixará de aparecer na loja. O histórico de pedidos e movimentações é mantido.',
      label: 'Desativar',
      onConfirm: async () => {
        await this.api.delete('/products/' + product.id);
        showToast('Produto desativado.');
        await this.show();
      },
    });
  }

  // Reativa via PUT { active: true }; o backend recusa se a categoria estiver desativada.
  async activate(product) {
    try {
      await this.api.put('/products/' + product.id, { active: true });
      showToast('Produto reativado.');
      await this.show();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}
