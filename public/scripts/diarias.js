// Variável para controlar listeners
let listenersInitialized = false;

document.addEventListener('DOMContentLoaded', function() {
    if (!listenersInitialized) {
        initializeListeners();
        listenersInitialized = true;
    }
    
    loadTurmasDisponiveis();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('diariaData').value = today;
    document.getElementById('filtroDataInicial').value = today;
    document.getElementById('filtroDataFinal').value = today;
    
    // Estado inicial da tabela
    document.getElementById('diariasTableBody').innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-muted py-4">
                Utilize os filtros para visualizar as diárias
            </td>
        </tr>
    `;
});

function initializeListeners() {
    document.getElementById('turmaSelect').addEventListener('change', handleTurmaChange);
    document.getElementById('diariaData').addEventListener('change', handleDataChange);
    document.getElementById('addDiariaForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('filtroForm').addEventListener('submit', function(e) {
        e.preventDefault();
        loadDiarias();
    });
}

function handleTurmaChange() {
    const turma = this.value;
    const data = document.getElementById('diariaData').value;
    
    if (turma) {
        document.getElementById('funcionarioSelect').disabled = false;
        loadFuncionariosPorTurma(turma);
        if (data) {
            loadProcessosPorTurmaData(turma, data);
        }
    } else {
        document.getElementById('funcionarioSelect').disabled = true;
        document.getElementById('funcionarioSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
        document.getElementById('processoSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
    }
}

function handleDataChange() {
    const data = this.value;
    const turma = document.getElementById('turmaSelect').value;
    
    if (turma && data) {
        loadProcessosPorTurmaData(turma, data);
    }
}

function handleFormSubmit(e) {
    e.preventDefault();
    addDiaria();
}

// Controle de requisições
let diariaFetchController = null;

function ensureSingleLoad() {
    if (diariaFetchController) {
        diariaFetchController.abort();
    }
    diariaFetchController = new AbortController();
    return diariaFetchController.signal;
}

function loadDiarias() {
    const turma = document.getElementById('filtroTurma').value;
    const dataInicial = document.getElementById('filtroDataInicial').value;
    const dataFinal = document.getElementById('filtroDataFinal').value;
    const processo = document.getElementById('filtroProcesso').value;
    
    const warningElement = document.getElementById('filterWarning');
    const tableBody = document.getElementById('diariasTableBody');
    
    if (!turma && !dataInicial && !dataFinal && !processo) {
        warningElement.style.display = 'block';
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    Selecione pelo menos um filtro para visualizar as diárias
                </td>
            </tr>
        `;
        return;
    }
    
    warningElement.style.display = 'none';
    
    const signal = ensureSingleLoad();
    
    let url = '/api/diarias?';
    if (turma) url += `turma=${encodeURIComponent(turma)}&`;
    if (dataInicial) url += `data_inicial=${dataInicial}&`;
    if (dataFinal) url += `data_final=${dataFinal}&`;
    if (processo) url += `processo=${encodeURIComponent(processo)}`;
    
    tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary" role="status"></div></td></tr>';
    
    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        signal: signal
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro na resposta do servidor');
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data)) throw new Error('Dados inválidos recebidos');
        
        const uniqueDiarias = data.filter((diaria, index, self) =>
            index === self.findIndex(d => d.id === diaria.id)
        );
        
        if (uniqueDiarias.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        Nenhuma diária encontrada com os filtros aplicados
                    </td>
                </tr>
            `;
        } else {
            renderDiariasTable(uniqueDiarias);
        }
    })
    .catch(error => {
        if (error.name !== 'AbortError') {
            console.error('Erro ao carregar diárias:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        Erro ao carregar diárias: ${error.message}
                    </td>
                </tr>
            `;
        }
    });
}

function renderDiariasTable(diarias) {
    const tableBody = document.getElementById('diariasTableBody');
    tableBody.innerHTML = '';

    diarias.forEach(diaria => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${diaria.data_formatada || new Date(diaria.data).toLocaleDateString('pt-BR')}</td>
            <td><span class="badge bg-primary">${diaria.turma || 'N/A'}</span></td>
            <td>${diaria.processo}</td>
            <td>${diaria.matricula}</td>
            <td>${diaria.nome}</td>
            <td class="text-end">
                <button onclick="confirmDelete(${diaria.id}, '${diaria.nome.replace(/'/g, "\\'")}')" 
                    class="btn btn-sm btn-outline-danger"
                    title="Remover diária">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

let isAddingDiaria = false;

function addDiaria() {
    if (isAddingDiaria) return;
    isAddingDiaria = true;
    
    const submitButton = document.querySelector('#addDiariaForm button[type="submit"]');
    const submitSpinner = document.getElementById('submitSpinner');
    const submitButtonText = document.getElementById('submitButtonText');
    
    submitSpinner.classList.remove('d-none');
    submitButtonText.textContent = 'Salvando...';
    submitButton.disabled = true;

    const turma = document.getElementById('turmaSelect').value;
    const funcionario = document.getElementById('funcionarioSelect').value;
    const data = document.getElementById('diariaData').value;
    const processo = document.getElementById('processoSelect').value;
    
    if (!turma || !funcionario || !data || !processo) {
        showAlert('Preencha todos os campos obrigatórios!', 'danger');
        submitSpinner.classList.add('d-none');
        submitButtonText.textContent = 'Salvar';
        submitButton.disabled = false;
        isAddingDiaria = false;
        return;
    }

    const signal = ensureSingleLoad();
    
    fetch('/api/diarias', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ data, processo, matricula: funcionario }),
        signal: signal
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Erro ao adicionar diária');
        return data;
    })
    .then(data => {
        showAlert(data.message || 'Diária adicionada com sucesso!', 'success');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('addDiariaModal'));
        modal.hide();
        
        document.getElementById('addDiariaForm').reset();
        document.getElementById('funcionarioSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
        document.getElementById('funcionarioSelect').disabled = true;
        document.getElementById('processoSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
        
        loadDiarias();
    })
    .catch(error => {
        if (error.name !== 'AbortError') {
            console.error('Erro ao adicionar diária:', error);
            showAlert(error.message || 'Erro ao adicionar diária', 'danger');
        }
    })
    .finally(() => {
        submitSpinner.classList.add('d-none');
        submitButtonText.textContent = 'Salvar';
        submitButton.disabled = false;
        isAddingDiaria = false;
    });
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.main-content .container');
    container.prepend(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function confirmDelete(id, nome) {
    const modal = document.getElementById('confirmModal');
    modal.querySelector('.modal-title').textContent = 'Confirmar Exclusão';
    modal.querySelector('.modal-body').textContent = `Tem certeza que deseja remover a diária de ${nome}?`;
    
    const confirmBtn = modal.querySelector('#confirmModalButton');
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    document.getElementById('confirmModalButton').onclick = function() {
        deleteDiaria(id);
    };
    
    new bootstrap.Modal(modal).show();
}

function deleteDiaria(id) {
    fetch(`/api/diarias/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao remover diária');
        return response.json();
    })
    .then(data => {
        if (data.message) {
            showAlert(data.message, 'success');
            loadDiarias();
            bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
        }
    })
    .catch(error => {
        console.error('Erro ao remover diária:', error);
        showAlert('Erro ao remover diária: ' + error.message, 'danger');
    });
}

function openAddModal() {
    const modalElement = document.getElementById('addDiariaModal');
    
    modalElement.addEventListener('shown.bs.modal', function() {
        this.setAttribute('aria-hidden', 'false');
    });
    
    modalElement.addEventListener('hidden.bs.modal', function() {
        this.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('addDiariaForm').reset();
    document.getElementById('funcionarioSelect').disabled = true;
    document.getElementById('funcionarioSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
    document.getElementById('processoSelect').innerHTML = '<option value="">Selecione a Turma primeiro</option>';
    document.getElementById('diariaData').valueAsDate = new Date();
    
    if (document.getElementById('turmaSelect').options.length <= 1) {
        loadTurmasDisponiveis();
    }
    
    new bootstrap.Modal(modalElement).show();
}

function loadTurmasDisponiveis() {
    fetch('/api/turmas_disponiveis', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao carregar turmas');
        return response.json();
    })
    .then(turmas => {
        const selectTurma = document.getElementById('turmaSelect');
        const filtroTurma = document.getElementById('filtroTurma');
        
        selectTurma.innerHTML = '<option value="">Selecione a Turma...</option>';
        filtroTurma.innerHTML = '<option value="">Todas</option>';
        
        turmas.forEach(turma => {
            const option = document.createElement('option');
            option.value = turma;
            option.textContent = turma;
            selectTurma.appendChild(option.cloneNode(true));
            filtroTurma.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erro ao carregar turmas:', error);
        document.getElementById('turmaSelect').innerHTML = '<option value="">Erro ao carregar turmas</option>';
    });
}

function loadFuncionariosPorTurma(turma) {
    if (!turma) return;
    
    fetch(`/api/funcionarios_por_turma/${encodeURIComponent(turma)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao carregar funcionários');
        return response.json();
    })
    .then(funcionarios => {
        const select = document.getElementById('funcionarioSelect');
        select.innerHTML = '<option value="">Selecione o Funcionário...</option>';
        
        if (funcionarios.length === 0) {
            select.innerHTML = '<option value="">Nenhum funcionário encontrado nesta turma</option>';
            return;
        }
        
        funcionarios.forEach(func => {
            const option = document.createElement('option');
            option.value = func.matricula;
            option.textContent = `${func.nome} (${func.matricula})`;
            select.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erro ao carregar funcionários:', error);
        document.getElementById('funcionarioSelect').innerHTML = '<option value="">Erro ao carregar funcionários</option>';
    });
}

function loadProcessosPorTurmaData(turma, data) {
    if (!turma || !data) return;

    fetch(`/api/processos_para_diarias?turma=${encodeURIComponent(turma)}&data=${data}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao buscar processos');
        return response.json();
    })
    .then(processos => {
        const selectProcesso = document.getElementById('processoSelect');
        selectProcesso.innerHTML = '<option value="">Selecione o Processo...</option>';
        
        if (processos.length === 0) {
            selectProcesso.innerHTML = '<option value="">Nenhum processo encontrado para esta turma/data</option>';
            return;
        }
        
        processos.forEach(processo => {
            const option = document.createElement('option');
            option.value = processo;
            option.textContent = processo;
            selectProcesso.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erro ao carregar processos:', error);
        document.getElementById('processoSelect').innerHTML = '<option value="">Erro ao carregar processos</option>';
    });
}

window.openAddModal = openAddModal;
window.loadDiarias = loadDiarias;
window.confirmDelete = confirmDelete;
window.deleteDiaria = deleteDiaria;