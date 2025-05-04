// turmas_ativas.js - Script para gerenciar turmas ativas

// Variável global para armazenar os dados das turmas
let turmasData = [];

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    loadTurmas();
    setInterval(updateDateTime, 1000);
});

// Função para carregar os dados das turmas
function loadTurmas() {
    fetch('/api/turmas')
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro na requisição');
            }
            return response.json();
        })
        .then(data => {
            turmasData = data;
            populateTurmaFilter();
            populateTable(data);
        })
        .catch(error => {
            console.error('Erro ao carregar turmas:', error);
            showAlert('danger', 'Erro ao carregar dados das turmas. Tente novamente.');
        });
}

// Preenche o filtro de turmas/encarregados
function populateTurmaFilter() {
    const turmaFilter = document.getElementById('turmaFilter');
    
    // Limpa opções existentes (mantendo apenas "Todos")
    while (turmaFilter.options.length > 1) {
        turmaFilter.remove(1);
    }
    
    // Obtém turmas/encarregados únicos
    const turmasUnicas = [...new Set(turmasData.map(item => item.turma_encarregado))].filter(Boolean);
    
    // Adiciona novas opções
    turmasUnicas.forEach(turma => {
        const option = document.createElement('option');
        option.value = turma;
        option.textContent = turma;
        turmaFilter.appendChild(option);
    });
}

// Aplica os filtros selecionados
function applyFilters() {
    const turmaFilter = document.getElementById('turmaFilter').value;
    const cargoFilter = document.getElementById('cargoFilter').value;
    
    let dadosFiltrados = turmasData;
    
    // Aplica filtros
    if (turmaFilter) {
        dadosFiltrados = dadosFiltrados.filter(membro => 
            membro.turma_encarregado === turmaFilter
        );
    }
    
    if (cargoFilter) {
        dadosFiltrados = dadosFiltrados.filter(membro => 
            membro.cargo === cargoFilter
        );
    }
    
    // Atualiza a tabela
    populateTable(dadosFiltrados);
}

// Preenche a tabela com os dados
function populateTable(data) {
    const tableBody = document.getElementById('turmasTableBody');
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="6" class="text-center py-4">
                Nenhum membro encontrado com os filtros selecionados.
            </td>
        `;
        tableBody.appendChild(row);
        return;
    }
    
    data.forEach(membro => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${membro.id || ''}</td>
            <td>${membro.matricula || ''}</td>
            <td>${membro.nome || ''}</td>
            <td>${membro.cargo || ''}</td>
            <td>${membro.turma_encarregado || 'Não atribuído'}</td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary" onclick="editMember(${membro.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="confirmDelete(${membro.id})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Adiciona um novo membro
function addMember() {
    const form = document.getElementById('addMemberForm');
    const formData = new FormData(form);
    const dados = Object.fromEntries(formData);
    
    // Mostrar spinner de carregamento
    const saveBtn = document.querySelector('#addMemberModal .btn-primary');
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    saveBtn.disabled = true;
    
    fetch('/api/turmas/adicionar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dados)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message || 'Erro ao adicionar membro'); });
        }
        return response.json();
    })
    .then(data => {
        showAlert('success', 'Membro adicionado com sucesso!');
        form.reset();
        const modal = bootstrap.Modal.getInstance(document.getElementById('addMemberModal'));
        modal.hide();
        loadTurmas();
    })
    .catch(error => {
        console.error('Erro:', error);
        showAlert('danger', error.message || 'Erro ao adicionar membro');
    })
    .finally(() => {
        // Restaurar botão
        saveBtn.innerHTML = 'Salvar';
        saveBtn.disabled = false;
    });
}

// Função para editar um membro (mover para outra turma)
function editMember(id) {
    const membro = turmasData.find(m => m.id === id);
    if (!membro) return;

    const modal = new bootstrap.Modal(document.getElementById('editMemberModal'));
    
    // Preenche o modal com os dados atuais
    document.getElementById('editMemberId').value = id;
    document.getElementById('editMemberName').textContent = membro.nome;
    document.getElementById('editCurrentTurma').textContent = membro.turma_encarregado || 'Não atribuído';
    
    // Preenche o select com as turmas disponíveis
    const turmaSelect = document.getElementById('editNewTurma');
    turmaSelect.innerHTML = '<option value="">Selecione uma turma</option>';
    
    const turmasUnicas = [...new Set(turmasData.map(item => item.turma_encarregado))].filter(Boolean);
    turmasUnicas.forEach(turma => {
        const option = document.createElement('option');
        option.value = turma;
        option.textContent = turma;
        turmaSelect.appendChild(option);
    });
    
    modal.show();
}

// Função para salvar a edição
function saveEdit() {
    const id = document.getElementById('editMemberId').value;
    const newTurma = document.getElementById('editNewTurma').value;
    
    if (!id || !newTurma) {
        showAlert('warning', 'Selecione uma turma para mover o membro');
        return;
    }
    
    // Mostrar spinner de carregamento
    const saveBtn = document.querySelector('#editMemberModal .btn-primary');
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
    saveBtn.disabled = true;
    
    fetch(`/api/turmas/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            turma_encarregado: newTurma
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message || 'Erro ao atualizar turma'); });
        }
        return response.json();
    })
    .then(data => {
        showAlert('success', 'Membro movido com sucesso!');
        const modal = bootstrap.Modal.getInstance(document.getElementById('editMemberModal'));
        modal.hide();
        loadTurmas();
    })
    .catch(error => {
        console.error('Erro:', error);
        showAlert('danger', error.message || 'Erro ao mover membro');
    })
    .finally(() => {
        // Restaurar botão
        saveBtn.innerHTML = 'Salvar Alterações';
        saveBtn.disabled = false;
    });
}

// Confirma a exclusão de um membro
function confirmDelete(id) {
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    
    document.getElementById('confirmModalTitle').textContent = 'Confirmar Exclusão';
    document.getElementById('confirmModalBody').innerHTML = `
        <p>Tem certeza que deseja remover este membro?</p>
        <p class="text-muted">Esta ação não pode ser desfeita.</p>
    `;
    
    const confirmBtn = document.getElementById('confirmModalButton');
    confirmBtn.onclick = function() {
        deleteMember(id);
        modal.hide();
    };
    
    modal.show();
}

// Exclui um membro
function deleteMember(id) {
    // Mostrar spinner no botão de confirmação
    const confirmBtn = document.getElementById('confirmModalButton');
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Excluindo...';
    confirmBtn.disabled = true;
    
    fetch(`/api/turmas/${id}`, {
        method: 'DELETE'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.message || 'Erro ao remover membro'); });
        }
        return response.json();
    })
    .then(data => {
        showAlert('success', 'Membro removido com sucesso!');
        loadTurmas();
    })
    .catch(error => {
        console.error('Erro:', error);
        showAlert('danger', error.message || 'Erro ao remover membro');
    })
    .finally(() => {
        // Restaurar botão
        confirmBtn.innerHTML = 'Confirmar';
        confirmBtn.disabled = false;
    });
}

// Mostra um alerta na página
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.container.py-4');
    container.insertBefore(alertDiv, container.firstChild);
    
    // Remove o alerta após 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Atualiza data e hora
function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date').textContent = now.toLocaleDateString('pt-BR');
    document.getElementById('current-time').textContent = now.toLocaleTimeString('pt-BR');
}

// Funções globais (chamadas diretamente do HTML)
window.openAddModal = function() {
    const modal = new bootstrap.Modal(document.getElementById('addMemberModal'));
    modal.show();
};

window.applyFilters = applyFilters;
window.addMember = addMember;
window.confirmDelete = confirmDelete;
window.editMember = editMember;
window.saveEdit = saveEdit;