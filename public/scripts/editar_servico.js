document.addEventListener('DOMContentLoaded', async () => {
    // Carrega a sidebar


    // Obtém o ID do serviço da URL
    const urlParams = new URLSearchParams(window.location.search);
    const servicoId = urlParams.get('id');

    if (!servicoId) {
        mostrarErro('ID do serviço não especificado');
        return;
    }

    // Configura o botão voltar
    document.getElementById('btn-voltar').href = `/detalhes_servico?id=${servicoId}`;
    document.getElementById('breadcrumb-servico').href = `/detalhes_servico?id=${servicoId}`;

    // Carrega os dados do serviço
    await carregarDadosServico(servicoId);

    // Carrega a lista de responsáveis
    await carregarResponsaveis();

    // Configura o comportamento do campo desligamento
    const desligamentoEl = document.getElementById('servico-desligamento');
    if (desligamentoEl) {
        desligamentoEl.addEventListener('change', function() {
            const desligamento = this.value === 'SIM';
            document.getElementById('hora-inicio-container').style.display = desligamento ? 'block' : 'none';
            document.getElementById('hora-fim-container').style.display = desligamento ? 'block' : 'none';
        });
    }
    // Configura o comportamento do campo status
    document.getElementById('servico-status').addEventListener('change', function() {
        const concluido = this.value === 'concluido';
        document.getElementById('conclusao-container').style.display = concluido ? 'block' : 'none';
        document.getElementById('data-conclusao-container').style.display = concluido ? 'block' : 'none';
    });

    // Configura o modal de anexos
    document.getElementById('btn-salvar-anexo').addEventListener('click', async () => {
        const servicoId = new URLSearchParams(window.location.search).get('id');
        await adicionarAnexo(servicoId);
    });

    // Configura o botão salvar
    document.getElementById('btn-salvar').addEventListener('click', async () => {
        await salvarAlteracoes(servicoId);
    });
});


async function carregarDadosServico(servicoId) {
    try {
        const response = await fetch(`/api/servicos/${servicoId}`);
        if (!response.ok) {
            throw new Error('Erro ao carregar dados do serviço');
        }

        const { success, data, message } = await response.json();

        if (!success) {
            throw new Error(message || 'Erro ao carregar dados');
        }

        // Preenche os campos do formulário
        document.getElementById('servico-id').value = data.id;
        document.getElementById('servico-processo').value = data.processo || '';
        document.getElementById('servico-status').value = data.status || 'ativo';
        document.getElementById('servico-subestacao').value = data.subestacao || '';
        document.getElementById('servico-alimentador').value = data.alimentador || '';
        document.getElementById('servico-chave-montante').value = data.chave_montante || '';
        document.getElementById('servico-desligamento').value = data.desligamento || 'NAO';
        document.getElementById('servico-hora-inicio').value = data.hora_inicio || '';
        document.getElementById('servico-hora-fim').value = data.hora_fim || '';
        document.getElementById('servico-maps').value = data.maps || '';
        document.getElementById('servico-data-prevista').value = formatarDataParaInput(data.data_prevista_execucao);
        document.getElementById('servico-data-conclusao').value = formatarDataParaInput(data.data_conclusao);
        document.getElementById('servico-observacoes').value = data.observacoes_conclusao || '';

        // Atualiza a exibição dos campos condicionais
        document.getElementById('servico-desligamento').dispatchEvent(new Event('change'));
        document.getElementById('servico-status').dispatchEvent(new Event('change'));

        // Preenche os anexos
        preencherAnexos(data.anexos || []);

    } catch (error) {
        console.error('Erro:', error);
        mostrarErro(error.message);
    }
}

async function carregarResponsaveis() {
    try {
        const response = await fetch('/api/responsaveis_tecnicos');
        if (!response.ok) {
            throw new Error('Erro ao carregar responsáveis');
        }

        const data = await response.json(); // <- sem destructuring

        const select = document.getElementById('servico-responsavel');
        select.innerHTML = '';

        data.forEach(responsavel => {
            const option = document.createElement('option');
            option.value = responsavel.matricula;
            option.textContent = `${responsavel.matricula} - ${responsavel.nome}`;
            select.appendChild(option);
        });

    } catch (error) {
        console.error('Erro ao carregar responsáveis:', error);
    }
}


function formatarDataParaInput(dataString) {
    if (!dataString) return '';
    try {
        const data = new Date(dataString);
        return data.toISOString().slice(0, 16);
    } catch (e) {
        console.error('Erro ao formatar data:', e);
        return '';
    }
}

function preencherAnexos(anexos) {
    const anexosContainer = document.getElementById('anexos-container');
    anexosContainer.innerHTML = '';

    if (anexos.length === 0) {
        anexosContainer.innerHTML = `
            <div class="col-12">
                <div class="text-center py-3">
                    <i class="fas fa-paperclip fa-2x text-muted mb-2"></i>
                    <p class="text-muted">Nenhum anexo encontrado</p>
                </div>
            </div>
        `;
        return;
    }

    anexos.forEach(anexo => {
        const anexoElement = document.createElement('div');
        anexoElement.className = 'col-md-4 col-6 mb-3';
        anexoElement.innerHTML = `
            <div class="attachment-card card h-100">
                <div class="card-body text-center">
                    <div class="attachment-thumbnail">
                        <i class="fas ${getFileIcon(anexo.nomeOriginal)}"></i>
                    </div>
                    <p class="small mb-1">${anexo.descricao || 'Sem descrição'}</p>
                    <div class="btn-group mt-2">
                        <a href="${anexo.caminho || '#'}" target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="${anexo.caminho || '#'}?download=true" download="${anexo.nomeOriginal || 'arquivo'}" class="btn btn-sm btn-outline-secondary">
                            <i class="fas fa-download"></i>
                        </a>
                        <button class="btn btn-sm btn-outline-danger btn-excluir-anexo" data-id="${anexo.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        anexosContainer.appendChild(anexoElement);
    });

    // Adiciona eventos aos botões de exclusão
    document.querySelectorAll('.btn-excluir-anexo').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const anexoId = btn.getAttribute('data-id');
            if (confirm('Tem certeza que deseja excluir este anexo?')) {
                await excluirAnexo(anexoId);
            }
        });
    });
}

function getFileIcon(filename) {
    if (!filename) return 'fa-file text-secondary';
    const ext = filename.split('.').pop().toLowerCase();

    const icons = {
        pdf: 'fa-file-pdf text-danger',
        doc: 'fa-file-word text-primary',
        docx: 'fa-file-word text-primary',
        xls: 'fa-file-excel text-success',
        xlsx: 'fa-file-excel text-success',
        ppt: 'fa-file-powerpoint text-warning',
        pptx: 'fa-file-powerpoint text-warning',
        jpg: 'fa-file-image text-info',
        jpeg: 'fa-file-image text-info',
        png: 'fa-file-image text-info',
        gif: 'fa-file-image text-info',
        zip: 'fa-file-archive text-secondary',
        rar: 'fa-file-archive text-secondary',
        txt: 'fa-file-alt text-secondary',
        csv: 'fa-file-csv text-success'
    };

    return icons[ext] || 'fa-file text-secondary';
}

async function excluirAnexo(anexoId) {
    try {
        const response = await fetch(`/api/anexos/${anexoId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const { success, message } = await response.json();
            if (success) {
                alert('Anexo excluído com sucesso!');
                // Recarrega os dados do serviço para atualizar a lista de anexos
                const servicoId = new URLSearchParams(window.location.search).get('id');
                await carregarDadosServico(servicoId);
            } else {
                throw new Error(message || 'Erro ao excluir anexo');
            }
        } else {
            throw new Error('Erro ao excluir anexo');
        }
    } catch (error) {
        console.error('Erro ao excluir anexo:', error);
        alert('Erro ao excluir anexo: ' + error.message);
    }
}

async function salvarAlteracoes(servicoId) {
    try {
        // Coletar apenas os campos que precisam ser atualizados
        const formData = {
            subestacao: document.getElementById('servico-subestacao').value,
            alimentador: document.getElementById('servico-alimentador').value || null,
            chave_montante: document.getElementById('servico-chave-montante').value || null,
            desligamento: document.getElementById('servico-desligamento').value,
            hora_inicio: document.getElementById('servico-hora-inicio').value || null,
            hora_fim: document.getElementById('servico-hora-fim').value || null,
            maps: document.getElementById('servico-maps').value || null,
            data_prevista_execucao: document.getElementById('servico-data-prevista').value,
            // Manter o responsável atual (se necessário)
            responsavel_matricula: document.getElementById('servico-responsavel').value || null
        };

        console.log('Dados a serem enviados:', formData);

        const response = await fetch(`/api/servicos/${servicoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao atualizar serviço');
        }

        const result = await response.json();
        
        if (result.success) {
            alert('Serviço atualizado com sucesso!');
            window.location.href = `/detalhes_servico?id=${servicoId}`;
        } else {
            throw new Error(result.message || 'Erro ao atualizar serviço');
        }
    } catch (error) {
        console.error('Erro ao salvar alterações:', error);
        alert('Erro ao salvar alterações: ' + error.message);
    }
}

async function fetchWithErrorHandling(url, options) {
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

function mostrarErro(mensagem) {
    const alerta = document.createElement('div');
    alerta.className = 'alert alert-danger';
    alerta.textContent = mensagem;
    document.querySelector('.main-content .container').prepend(alerta);
}

