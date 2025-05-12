// Variáveis globais
let servicosData = [];
let currentServicoId = null;
const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
const concluirModal = new bootstrap.Modal(document.getElementById('concluirModal'));
const toastLive = document.getElementById('liveToast');
const toast = new bootstrap.Toast(toastLive);

// Mostrar notificação
function showToast(message, type = 'success') {
    const toastBody = toastLive.querySelector('.toast-body');
    toastBody.textContent = message;

    // Reset classes
    toastLive.className = 'toast';
    toastLive.classList.add('bg-' + type);

    toast.show();
}

// Verificar se é dispositivo móvel
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Carregar serviços ativos e filtros
async function carregarDadosIniciais() {
    try {
        // Carrega serviços ativos
        await carregarServicosAtivos();

        // Carrega subestações para o filtro
        const responseSubestacoes = await fetch('/api/subestacoes');
        if (responseSubestacoes.ok) {
            const subestacoes = await responseSubestacoes.json();
            const selectSubestacao = document.getElementById('filtroSubestacao');

            subestacoes.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.nome;
                option.textContent = sub.nome;
                selectSubestacao.appendChild(option);
            });
        }

        // Carrega encarregados para o filtro
        const responseEncarregados = await fetch('/api/responsaveis_tecnicos');
        if (responseEncarregados.ok) {
            const encarregados = await responseEncarregados.json();
            const selectEncarregado = document.getElementById('filtroEncarregado');

            encarregados.forEach(enc => {
                const option = document.createElement('option');
                option.value = enc.matricula;
                option.textContent = `${enc.matricula} - ${enc.nome}`;
                selectEncarregado.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        showToast('Erro ao carregar dados iniciais', 'danger');
    }
}

// Carregar serviços ativos
async function carregarServicosAtivos() {
    try {
        const response = await fetch('/api/servicos?status=ativo');

        if (!response.ok) {
            throw new Error('Erro ao carregar serviços');
        }

        servicosData = await response.json();

        if (!Array.isArray(servicosData)) {
            throw new Error('Formato de dados inválido');
        }

        // Ordenar por data mais recente primeiro
        servicosData.sort((a, b) => {
            return new Date(b.data_prevista_execucao) - new Date(a.data_prevista_execucao);
        });

        atualizarTabela();

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showToast('Erro ao carregar serviços: ' + error.message, 'danger');
    }
}

// Atualizar tabela com os dados
function atualizarTabela() {
    const tbody = document.getElementById('tabela-servicos');
    tbody.innerHTML = '';

    // Aplicar lógica para restringir visualização ao encarregado 2443
    if (user && user.matricula && !['Engenheiro', 'Técnico', 'ADMIN','Inspetor'].includes(user.cargo)) {
        servicosData = servicosData.filter(s => s.responsavel_matricula === user.matricula);
    }

    // Aplicar filtros
    const filtroProcesso = document.getElementById('filtroProcesso').value.toLowerCase();
    const filtroSubestacao = document.getElementById('filtroSubestacao').value;
    const filtroEncarregado = document.getElementById('filtroEncarregado').value;
    const filtroData = document.getElementById('filtroData').value;

    const servicosFiltrados = servicosData.filter(servico => {
        return (servico.prioridade === 'EMERGENCIAL' || servico.processo.toLowerCase().includes(filtroProcesso)) &&
            (filtroSubestacao === '' || servico.subestacao === filtroSubestacao) &&
            (filtroEncarregado === '' || servico.responsavel_matricula === filtroEncarregado) &&
            (filtroData === '' || servico.data_prevista_execucao.includes(filtroData));
    }).slice(0, 15);

    if (servicosFiltrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-info-circle me-2"></i>Nenhum serviço encontrado
                </td>
            </tr>
        `;
        return;
    }

    servicosFiltrados.forEach(servico => {
        const tr = document.createElement('tr');
        tr.className = servico.prioridade === 'EMERGENCIAL' ? 'emergency-row' : 'glass-table-row';
        tr.setAttribute('data-id', servico.id);

        const processoDisplay = servico.prioridade === 'EMERGENCIAL' ?
            'EMERGENCIAL' :
            servico.processo;

        tr.innerHTML = `
            <td>${servico.id}</td>
            <td>${processoDisplay}</td>
            <td>${servico.subestacao}</td>
            <td>${servico.alimentador || 'Não informado'}</td>
            <td>${formatarData(servico.data_prevista_execucao)}</td>
            <td>
                ${servico.responsavel_matricula === 'pendente' ?
                '<span class="badge bg-warning">Pendente</span>' :
                servico.responsavel_matricula + ' - ' + (servico.responsavel || servico.responsavel_nome || 'Não informado')}
            </td>
            <td>
                ${servico.desligamento === 'SIM' ?
                '<span class="badge bg-danger">Sim</span>' :
                '<span class="badge bg-success">Não</span>'}
            </td>
            <td class="text-center">
                <div class="btn-group" role="group">
                    <button class="btn btn-sm glass-btn me-1" onclick="window.location.href='/detalhes_servico?id=${servico.id}'" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm glass-btn btn-primary me-1" onclick="selecionarResponsavel(${servico.id})" title="Selecionar Responsável">
                        <i class="fas fa-user-edit"></i>
                    </button>
                    <button class="btn btn-sm glass-btn btn-success me-1" onclick="concluirServico(${servico.id})" title="Concluir Serviço">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn btn-sm glass-btn btn-danger" onclick="confirmarExclusao(${servico.id})" title="Excluir Serviço">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Selecionar responsável
async function selecionarResponsavel(servicoId) {
    currentServicoId = servicoId;

    try {
        const response = await fetch('/api/responsaveis_tecnicos', {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar responsáveis');
        }

        const responsaveis = await response.json();

        // Preencher o corpo do modal existente
        const modalBody = document.getElementById('modalResponsavelBody');
        modalBody.innerHTML = `
            <div class="mb-3">
                <label for="selectResponsavel" class="form-label">Selecione o Responsável:</label>
                <select class="form-select glass-input" id="selectResponsavel">
                    <option value="">Selecione um responsável...</option>
                    <option value="pendente">Pendente</option>
                    ${responsaveis.map(r =>
                    `<option value="${r.matricula}">${r.matricula} - ${r.nome}</option>`
                ).join('')}
                </select>
            </div>
        `;

        // Mostrar o modal existente
        const modal = new bootstrap.Modal(document.getElementById('modalResponsavel'));
        modal.show();

    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
        showToast('Erro ao carregar lista de responsáveis', 'danger');
    }
}

// Confirmar responsável
async function confirmarResponsavel() {
    const select = document.getElementById('selectResponsavel');
    const responsavelMatricula = select.value;

    if (!responsavelMatricula) {
        showToast('Selecione um responsável', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/servicos/${currentServicoId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                responsavel_matricula: responsavelMatricula
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar responsável');
        }

        showToast('Responsável atribuído com sucesso', 'success');
        await carregarServicosAtivos();

    } catch (error) {
        console.error('Erro ao atribuir responsável:', error);
        showToast('Erro ao atribuir responsável: ' + error.message, 'danger');
    }
}

// Confirmar exclusão
function confirmarExclusao(id) {
    currentServicoId = id;
    confirmModal.show();
}

// Excluir serviço
async function excluirServico() {
    const btnDelete = document.getElementById('confirmDelete');
    const originalText = btnDelete.innerHTML;

    try {
        btnDelete.disabled = true;
        btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';

        const response = await fetch(`/api/servicos/${currentServicoId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao excluir serviço');
        }

        showToast('Serviço excluído com sucesso!', 'success');
        confirmModal.hide();
        await carregarServicosAtivos();

    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        showToast('Erro ao excluir serviço: ' + error.message, 'danger');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = originalText;
    }
}

// Concluir serviço
function concluirServico(id) {
    currentServicoId = id;
    // Define a data atual como padrão, mas permite edição
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dataConclusao').value = today;
    document.getElementById('observacoesConclusao').value = '';
    document.getElementById('fotosConclusao').value = '';
    document.getElementById('fotoCamera').value = '';
    document.getElementById('previewContainer').innerHTML = '';
    concluirModal.show();
}

// Finalizar serviço
async function finalizarServico() {
    const btnConcluir = document.getElementById('confirmConcluir');
    const originalText = btnConcluir.innerHTML;

    try {
        btnConcluir.disabled = true;
        btnConcluir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

        const dataConclusao = document.getElementById('dataConclusao').value;
        const observacoes = document.getElementById('observacoesConclusao').value;
        const fotosInput = document.getElementById('fotosConclusao');
        const formData = new FormData();

        formData.append('data_conclusao', dataConclusao);
        formData.append('observacoes', observacoes);

        // Adiciona cada foto ao FormData
        if (fotosInput.files.length > 0) {
            for (let i = 0; i < fotosInput.files.length; i++) {
                formData.append('fotos_conclusao', fotosInput.files[i]);
            }
        }

        const response = await fetch(`/api/servicos/${currentServicoId}/concluir`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao concluir serviço');
        }

        // Limpar formulário e fechar modal
        document.getElementById('formConcluirServico').reset();
        document.getElementById('previewContainer').innerHTML = '';

        showToast('Serviço concluído com sucesso!', 'success');
        concluirModal.hide();
        await carregarServicosAtivos();

    } catch (error) {
        console.error('Erro ao concluir serviço:', error);
        showToast('Erro ao concluir serviço: ' + error.message, 'danger');
    } finally {
        btnConcluir.disabled = false;
        btnConcluir.innerHTML = originalText;
    }
}

// Formatar data
function formatarData(dataString) {
    if (!dataString) return 'Não informado';
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR');
}

// Event Listeners
document.getElementById('confirmDelete').addEventListener('click', excluirServico);
document.getElementById('confirmConcluir').addEventListener('click', finalizarServico);

// Listeners para filtros
document.getElementById('filtroProcesso').addEventListener('input', atualizarTabela);
document.getElementById('filtroSubestacao').addEventListener('change', atualizarTabela);
document.getElementById('filtroEncarregado').addEventListener('change', atualizarTabela);
document.getElementById('filtroData').addEventListener('change', atualizarTabela);

// Configurar eventos para os botões de foto
document.getElementById('btnTirarFoto').addEventListener('click', function () {
    if (isMobileDevice()) {
        document.getElementById('fotoCamera').click();
    } else {
        document.getElementById('fotosConclusao').click();
    }
});

document.getElementById('btnAdicionarFotos').addEventListener('click', function () {
    document.getElementById('fotosConclusao').click();
});

// Atualize o listener para a foto da câmera
document.getElementById('fotoCamera').addEventListener('change', function (e) {
    if (this.files.length > 0) {
        // Adiciona a foto tirada ao input múltiplo
        const fotosInput = document.getElementById('fotosConclusao');
        const dataTransfer = new DataTransfer();

        // Mantém as fotos já selecionadas
        for (let i = 0; i < fotosInput.files.length; i++) {
            dataTransfer.items.add(fotosInput.files[i]);
        }

        // Adiciona a nova foto
        dataTransfer.items.add(this.files[0]);
        fotosInput.files = dataTransfer.files;

        // Dispara o evento change para atualizar o preview
        const event = new Event('change');
        fotosInput.dispatchEvent(event);

        // Limpa o input da câmera para permitir novas fotos
        this.value = '';
    }
});

// Atualize o listener para o preview de fotos
document.getElementById('fotosConclusao').addEventListener('change', function (e) {
    const previewContainer = document.getElementById('previewContainer');
    previewContainer.innerHTML = '';

    if (this.files.length > 5) {
        showToast('Máximo de 5 fotos permitidas!', 'danger');
        this.value = '';
        return;
    }

    Array.from(this.files).forEach((file, index) => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (event) {
                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3';
                col.innerHTML = `
                    <div class="preview-item">
                        <img src="${event.target.result}" alt="Preview ${index + 1}">
                        <button type="button" class="btn-remove" onclick="removerFotoPreview(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
                previewContainer.appendChild(col);
            };
            reader.readAsDataURL(file);
        }
    });
});

// Função global para remover foto do preview
window.removerFotoPreview = function (index) {
    const input = document.getElementById('fotosConclusao');
    const files = Array.from(input.files);
    files.splice(index, 1);

    // Criar nova DataTransfer para atualizar os arquivos
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    input.files = dataTransfer.files;

    // Disparar evento change para atualizar o preview
    const event = new Event('change');
    input.dispatchEvent(event);
};

// Inicialização
document.addEventListener('DOMContentLoaded', carregarDadosIniciais);