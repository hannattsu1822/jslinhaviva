/**
 * Script principal da página de Serviços Concluídos
 * Contém toda a lógica de carregamento, filtragem e exibição dos serviços
 */

// Objeto para armazenar elementos do DOM
const elementos = {
    toast: null,
    tabela: null,
    paginacao: null,
    contador: null,
    filtros: {
        processo: null,
        subestacao: null,
        alimentador: null,
        data: null
    }
};

// Variáveis de estado
let servicosData = [];
let currentPage = 1;
const itemsPerPage = 10;

// Inicialização - Executa quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    inicializarElementos();
    configurarEventListeners();
    carregarServicosConcluidos();
});

/**
 * Inicializa todos os elementos do DOM
 */
function inicializarElementos() {
    try {
        // Elementos principais
        elementos.toast = new bootstrap.Toast(document.getElementById('liveToast'));
        elementos.tabela = document.getElementById('tabela-servicos');
        elementos.paginacao = document.getElementById('paginacao');
        elementos.contador = document.getElementById('contador-servicos');
        
        // Elementos de filtro
        elementos.filtros.processo = document.getElementById('filtroProcesso');
        elementos.filtros.subestacao = document.getElementById('filtroSubestacao');
        elementos.filtros.alimentador = document.getElementById('filtroAlimentador');
        elementos.filtros.data = document.getElementById('filtroData');
        
        // Verifica se todos os elementos essenciais existem
        if (!elementos.tabela) throw new Error('Elemento tabela-servicos não encontrado');
        if (!elementos.contador) throw new Error('Elemento contador-servicos não encontrado');
        
    } catch (error) {
        console.error('Erro na inicialização dos elementos:', error);
        mostrarNotificacao('Erro ao inicializar a página. Recarregue e tente novamente.', 'danger');
    }
}

/**
 * Configura os event listeners para os filtros
 */
function configurarEventListeners() {
    try {
        if (elementos.filtros.processo) {
            elementos.filtros.processo.addEventListener('input', debounce(atualizarTabela, 300));
        }
        if (elementos.filtros.subestacao) {
            elementos.filtros.subestacao.addEventListener('input', debounce(atualizarTabela, 300));
        }
        if (elementos.filtros.alimentador) {
            elementos.filtros.alimentador.addEventListener('input', debounce(atualizarTabela, 300));
        }
        if (elementos.filtros.data) {
            elementos.filtros.data.addEventListener('change', atualizarTabela);
        }
    } catch (error) {
        console.error('Erro ao configurar event listeners:', error);
    }
}

/**
 * Debounce para melhorar performance dos filtros
 * @param {Function} func - Função a ser executada
 * @param {number} wait - Tempo de espera em ms
 */
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

/**
 * Carrega os serviços concluídos da API
 */
async function carregarServicosConcluidos() {
    try {
        mostrarNotificacao('Carregando serviços concluídos...', 'info');
        
        const response = await fetch('/api/servicos?status=concluido');
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('Formato de dados inválido - esperado array');
        }

        servicosData = data;
        atualizarTabela();
        atualizarPaginacao();
        
        mostrarNotificacao('Serviços carregados com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        mostrarNotificacao('Erro ao carregar serviços concluídos: ' + error.message, 'danger');
    }
}

/**
 * Mostra uma notificação toast
 * @param {string} mensagem - Mensagem a ser exibida
 * @param {string} tipo - Tipo de notificação (success, danger, info, warning)
 */
function mostrarNotificacao(mensagem, tipo = 'success') {
    try {
        if (!elementos.toast) return;
        
        const toastBody = document.querySelector('.toast-body');
        if (toastBody) {
            toastBody.textContent = mensagem;
            const toastElement = document.getElementById('liveToast');
            
            // Reset classes
            toastElement.className = 'toast';
            toastElement.classList.add('bg-' + tipo);
            
            elementos.toast.show();
        }
    } catch (error) {
        console.error('Erro ao mostrar notificação:', error);
    }
}

/**
 * Atualiza a tabela com os dados filtrados e paginados
 */
function atualizarTabela() {
    try {
        if (!elementos.tabela || !elementos.contador) return;
        
        elementos.tabela.innerHTML = '';

        // Obter valores dos filtros com fallback para strings vazias
        const filtroProcesso = elementos.filtros.processo?.value.toLowerCase() || '';
        const filtroSubestacao = elementos.filtros.subestacao?.value.toLowerCase() || '';
        const filtroAlimentador = elementos.filtros.alimentador?.value.toLowerCase() || '';
        const filtroData = elementos.filtros.data?.value || '';

        // Aplicar filtros
        const servicosFiltrados = servicosData.filter(servico => {
            const processo = servico.processo?.toLowerCase() || '';
            const subestacao = servico.subestacao?.toLowerCase() || '';
            const alimentador = servico.alimentador?.toLowerCase() || '';
            const dataConclusao = servico.data_conclusao || '';
            
            return processo.includes(filtroProcesso) &&
                   subestacao.includes(filtroSubestacao) &&
                   alimentador.includes(filtroAlimentador) &&
                   (filtroData === '' || dataConclusao.includes(filtroData));
        });

        // Atualizar contador
        elementos.contador.textContent = `${servicosFiltrados.length} ${servicosFiltrados.length === 1 ? 'serviço' : 'serviços'}`;

        // Paginação
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const servicosPagina = servicosFiltrados.slice(startIndex, endIndex);

        if (servicosPagina.length === 0) {
            elementos.tabela.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-info-circle me-2"></i>Nenhum serviço concluído encontrado
                    </td>
                </tr>
            `;
            return;
        }

        // Preencher tabela
        servicosPagina.forEach(servico => {
            const tr = document.createElement('tr');
            tr.className = 'glass-table-row';
            tr.innerHTML = `
                <td>${servico.id || 'N/A'}</td>
                <td>${servico.processo || 'Não informado'}</td>
                <td>${servico.subestacao || 'Não informado'}</td>
                <td>${servico.alimentador || 'Não informado'}</td>
                <td>${formatarData(servico.data_conclusao)}</td>
                <td>${servico.responsavel || 'Não informado'}</td>
                <td class="text-center">
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm glass-btn me-1" onclick="window.location.href='/detalhes_servico?id=${servico.id}'" title="Visualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm glass-btn btn-warning" onclick="reativarServico(${servico.id})" title="Retornar para Ativos">
                            <i class="fas fa-undo"></i>
                        </button>
                    </div>
                </td>
            `;
            elementos.tabela.appendChild(tr);
        });

    } catch (error) {
        console.error('Erro ao atualizar tabela:', error);
        mostrarNotificacao('Erro ao atualizar tabela de serviços', 'danger');
    }
}

/**
 * Atualiza a paginação baseada nos dados filtrados
 */
function atualizarPaginacao() {
    try {
        if (!elementos.paginacao) return;
        
        elementos.paginacao.innerHTML = '';

        const totalPages = Math.ceil(servicosData.length / itemsPerPage);

        if (totalPages <= 1) return;

        // Botão Anterior
        const liPrev = document.createElement('li');
        liPrev.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        liPrev.innerHTML = `<a class="page-link glass-btn" href="#" onclick="mudarPagina(${currentPage - 1})">Anterior</a>`;
        elementos.paginacao.appendChild(liPrev);

        // Números das páginas
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link glass-btn" href="#" onclick="mudarPagina(${i})">${i}</a>`;
            elementos.paginacao.appendChild(li);
        }

        // Botão Próximo
        const liNext = document.createElement('li');
        liNext.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        liNext.innerHTML = `<a class="page-link glass-btn" href="#" onclick="mudarPagina(${currentPage + 1})">Próximo</a>`;
        elementos.paginacao.appendChild(liNext);

    } catch (error) {
        console.error('Erro ao atualizar paginação:', error);
    }
}

/**
 * Muda para uma página específica
 * @param {number} page - Número da página
 */
function mudarPagina(page) {
    try {
        if (page < 1 || page > Math.ceil(servicosData.length / itemsPerPage)) return;
        
        currentPage = page;
        atualizarTabela();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Erro ao mudar página:', error);
    }
}

/**
 * Formata uma data para o formato brasileiro
 * @param {string} dataString - Data no formato ISO
 * @returns {string} Data formatada
 */
function formatarData(dataString) {
    try {
        if (!dataString) return 'Não informado';
        
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return 'Data inválida';
        
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Erro ao formatar';
    }
}

/**
 * Reativa um serviço (retorna para ativos)
 * @param {number} id - ID do serviço
 */
async function reativarServico(id) {
    try {
        if (!confirm('Deseja realmente retornar este serviço para ativos?')) {
            return;
        }

        mostrarNotificacao('Reativando serviço...', 'info');
        
        const response = await fetch(`/api/servicos/${id}/reativar`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        mostrarNotificacao('Serviço retornado para ativos com sucesso!', 'success');
        await carregarServicosConcluidos();
        
    } catch (error) {
        console.error('Erro ao reativar serviço:', error);
        mostrarNotificacao('Erro ao reativar serviço: ' + error.message, 'danger');
    }
}

// Exponha funções que são chamadas diretamente do HTML
window.reativarServico = reativarServico;
window.mudarPagina = mudarPagina;