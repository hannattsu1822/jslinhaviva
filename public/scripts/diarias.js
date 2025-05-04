// Variável para controlar listeners
let listenersInitialized = false;
let currentDiarias = []; // Armazena as diárias atualmente filtradas

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
        document.getElementById('processosOptions').innerHTML = '';
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
        currentDiarias = [];
        return;
    }
    
    warningElement.style.display = 'none';
    
    const signal = ensureSingleLoad();
    
    // Construa a URL corretamente
    let url = '/api/diarias?';
    const params = [];
    
    if (turma) params.push(`turma=${encodeURIComponent(turma)}`);
    if (dataInicial) params.push(`dataInicial=${dataInicial}`);
    if (dataFinal) params.push(`dataFinal=${dataFinal}`);
    if (processo) params.push(`processo=${encodeURIComponent(processo)}`);
    
    url += params.join('&');
    
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
        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!Array.isArray(data)) {
            throw new Error('Dados inválidos recebidos');
        }
        
        currentDiarias = data;
        
        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        Nenhuma diária encontrada com os filtros aplicados
                    </td>
                </tr>
            `;
        } else {
            renderDiariasTable(data);
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
        document.getElementById('processosOptions').innerHTML = '';
        
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
    document.getElementById('processosOptions').innerHTML = '';
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

    fetch(`/api/processos_por_turma_data?turma=${encodeURIComponent(turma)}&data=${data}`, {
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
        const datalist = document.getElementById('processosOptions');
        const filtroDatalist = document.getElementById('filtroProcessosOptions');
        datalist.innerHTML = '';
        filtroDatalist.innerHTML = '';
        
        if (processos.length === 0) {
            return;
        }
        
        processos.forEach(processo => {
            const option = document.createElement('option');
            option.value = processo;
            datalist.appendChild(option.cloneNode(true));
            filtroDatalist.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Erro ao carregar processos:', error);
    });
}

function exportToPDF() {
    if (currentDiarias.length === 0) {
        showAlert('Não há diárias para exportar. Aplique os filtros primeiro.', 'warning');
        return;
    }

    const btnExport = document.getElementById('exportPdfBtn');
    const originalText = btnExport.innerHTML;
    btnExport.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Gerando PDF...';
    btnExport.disabled = true;

    // Obter os filtros aplicados
    const turma = document.getElementById('filtroTurma').value || 'Todas';
    const dataInicial = document.getElementById('filtroDataInicial').value || '';
    const dataFinal = document.getElementById('filtroDataFinal').value || '';
    const processo = document.getElementById('filtroProcesso').value || 'Todos';

    // Verificar se currentDiarias é um array válido
    if (!Array.isArray(currentDiarias)) {
        console.error('currentDiarias não é um array válido:', currentDiarias);
        showAlert('Erro ao preparar dados para o PDF', 'danger');
        btnExport.innerHTML = originalText;
        btnExport.disabled = false;
        return;
    }

    // Preparar dados para o PDF
    const dados = {
        diarias: currentDiarias,
        filtros: {
            turma,
            dataInicial,
            dataFinal,
            processo
        },
        usuario: JSON.parse(localStorage.getItem('user')) || { nome: 'Usuário', matricula: 'N/A' }
    };

    fetch('/api/gerar_pdf_diarias', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(dados)
    })
    .then(response => {
        if (!response.ok) throw new Error('Erro ao gerar PDF');
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_Diarias_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    })
    .catch(error => {
        console.error('Erro ao exportar PDF:', error);
        showAlert('Erro ao gerar PDF: ' + error.message, 'danger');
    })
    .finally(() => {
        btnExport.innerHTML = originalText;
        btnExport.disabled = false;
    });
}

// Expor funções globais
window.openAddModal = openAddModal;
window.loadDiarias = loadDiarias;
window.confirmDelete = confirmDelete;
window.deleteDiaria = deleteDiaria;
window.exportToPDF = exportToPDF;