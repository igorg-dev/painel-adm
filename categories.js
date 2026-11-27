// admin-panel/js/categories.js — TELA "CATEGORIAS"
// Listar, criar, renomear, desativar e reativar categorias.

// Tela de categorias.
class CategoriesView extends View {
  async render() {
    // Pede também as inativas (o backend só permite isso para admin).
    this.categories = await this.api.get('/categories', { include_inactive: 'true' });
    let rows = '';
    for (const category of this.categories) {
      // Botão alterna entre 'Desativar' e 'Reativar' conforme a situação.
      const toggle = category.active
        ? '<button class="btn btn-small btn-quiet" type="button" data-action="deactivate" data-id="' + category.id + '">Desativar</button>'
        : '<button class="btn btn-small btn-quiet" type="button" data-action="activate" data-id="' + category.id + '">Reativar</button>';
      rows +=
        '<tr class="' + (category.active ? '' : 'is-muted') + '"><td><strong>' + escapeHtml(category.name) + '</strong></td>' +
        '<td>' + badge(category.active ? 'Ativa' : 'Inativa', category.active ? 'ok' : 'off') + '</td>' +
        '<td class="actions"><button class="btn btn-small" type="button" data-action="rename" data-id="' + category.id + '">Renomear</button>' + toggle + '</td></tr>';
    }
    // Monta o botão 'Nova categoria' e a tabela (ou estado vazio).
    this.root.innerHTML =
      '<div class="toolbar"><button class="btn btn-primary push" type="button" data-action="create">Nova categoria</button></div>' +
      '<div class="panel table-wrap">' +
      (rows
        ? '<table><thead><tr><th>Nome</th><th>Situação</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : emptyState('Nenhuma categoria', 'Cadastre a primeira categoria para organizar os produtos.')) +
      '</div>';

    // Mapa ação -> função, usando delegação de eventos (veja View.bindClicks).
    this.bindClicks({
      create: () => this.openForm(null),
      rename: (data) => this.openForm(this.find(data.id)),
      deactivate: (data) => this.askDeactivate(this.find(data.id)),
      activate: (data) => this.activate(this.find(data.id)),
    });
  }

  // Procura a categoria pelo id (data-id chega como texto, daí o Number()).
  find(id) {
    return this.categories.find((item) => item.id === Number(id));
  }

  // Abre o modal para criar (category = null) ou renomear.
  openForm(category) {
    const editing = category !== null;
    this.modal.open({
      title: editing ? 'Renomear categoria' : 'Nova categoria',
      submitLabel: 'Salvar',
      body: fieldHtml('Nome', 'name', '<input name="name" maxlength="80" value="' + (editing ? escapeHtml(category.name) : '') + '">'),
      onSubmit: async (form) => {
        // FormData lê os campos do formulário pelo atributo name.
        const name = new FormData(form).get('name').trim();
        if (!name) throw new ApiError(400, 'Revise os campos destacados.', [{ field: 'name', message: 'Informe o nome da categoria.' }]);
        // Edição = PUT; criação = POST.
        if (editing) {
          await this.api.put('/categories/' + category.id, { name });
        } else {
          await this.api.post('/categories', { name });
        }
        showToast(editing ? 'Categoria atualizada.' : 'Categoria cadastrada.');
        await this.show();
      },
    });
  }

  // Pede confirmação antes de desativar. A regra 'sem produtos ativos' é validada pelo backend, e o erro aparece no modal.
  askDeactivate(category) {
    this.confirm({
      title: 'Desativar categoria',
      message: 'A categoria <strong>' + escapeHtml(category.name) + '</strong> só pode ser desativada se não tiver produtos ativos.',
      label: 'Desativar',
      onConfirm: async () => {
        await this.api.delete('/categories/' + category.id);
        showToast('Categoria desativada.');
        await this.show();
      },
    });
  }

  // Reativar não precisa de confirmação; erros viram toast.
  async activate(category) {
    try {
      await this.api.put('/categories/' + category.id, { active: true });
      showToast('Categoria reativada.');
      await this.show();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
}
