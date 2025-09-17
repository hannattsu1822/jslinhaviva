document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('reles-dashboard');
    const loadingMessage = document.getElementById('loading-message');
    const releUpdateTimers = {};

    // Função para criar o HTML de um card de relé
    function criarReleCard(rele) {
        return `
            <div class="rele-card" id="rele-card-${rele.id}" data-rele-id="${rele.id}">
                <div class="card-header">
                    <h3><span class="material-icons">bolt</span>${rele.nome_rele}</h3>
                    <span class="status-indicator no-data" id="status-indicator-${rele.id}">Aguardando</span>
                </div>
                <div class="card-body">
                    <div class="data-point">
                        <span class="label">Tensão (V)</span>
                        <span class="value" id="tensao-${rele.id}">-</span>
                    </div>
                    <div class="data-point">
                        <span class="label">Corrente (A)</span>
                        <span class="value" id="corrente-${rele.id}">-</span>
                    </div>
                    <div class="data-point">
                        <span class="label">Frequência (Hz)</span>
                        <span class="value" id="frequencia-${rele.id}">-</span>
                    </div>
                </div>
                <div class="card-footer">
                    <span id="timestamp-${rele.id}">Nenhuma leitura recebida.</span>
                </div>
            </div>
        `;
    }

    // Função para carregar os relés iniciais da API
    async function carregarRelesIniciais() {
        try {
            const response = await fetch('/api/reles');
            if (!response.ok) throw new Error('Falha ao buscar relés.');
            
            const reles = await response.json();
            
            if (reles.length > 0) {
                loadingMessage.style.display = 'none';
                reles.filter(r => r.ativo).forEach(rele => {
                    dashboard.innerHTML += criarReleCard(rele);
                });
            } else {
                loadingMessage.textContent = 'Nenhum relé ativo para monitorar.';
            }
        } catch (error) {
            console.error('Erro ao carregar relés:', error);
            loadingMessage.textContent = 'Erro ao carregar dispositivos.';
        }
    }

    // Função para conectar ao WebSocket e ouvir atualizações
    function conectarWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

        ws.onopen = () => console.log('WebSocket conectado.');
        ws.onerror = (error) => console.error('Erro no WebSocket:', error);
        ws.onclose = () => {
            console.log('WebSocket desconectado. Tentando reconectar em 5 segundos...');
            setTimeout(conectarWebSocket, 5000);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'nova_leitura_rele') {
                    atualizarCard(message.dados);
                }
            } catch (e) {
                console.error('Erro ao processar mensagem do WebSocket:', e);
            }
        };
    }

    // Função para atualizar um card com novos dados
    function atualizarCard(dados) {
        const card = document.getElementById(`rele-card-${dados.rele_id}`);
        if (!card) return;

        // Atualiza os valores
        const tensaoEl = document.getElementById(`tensao-${dados.rele_id}`);
        const correnteEl = document.getElementById(`corrente-${dados.rele_id}`);
        
        tensaoEl.textContent = `${dados.tensao_a.toFixed(1)} | ${dados.tensao_b.toFixed(1)} | ${dados.tensao_c.toFixed(1)}`;
        correnteEl.textContent = `${dados.corrente_a.toFixed(2)} | ${dados.corrente_b.toFixed(2)} | ${dados.corrente_c.toFixed(2)}`;
        document.getElementById(`frequencia-${dados.rele_id}`).textContent = dados.frequencia.toFixed(2);
        
        const timestamp = new Date(dados.timestamp_leitura);
        document.getElementById(`timestamp-${dados.rele_id}`).textContent = `Última leitura: ${timestamp.toLocaleString('pt-BR')}`;

        // Atualiza o status
        const statusIndicator = document.getElementById(`status-indicator-${dados.rele_id}`);
        statusIndicator.textContent = 'Online';
        statusIndicator.className = 'status-indicator online';
        card.className = 'rele-card status-online';

        // Efeito visual de atualização
        card.classList.add('just-updated');
        setTimeout(() => card.classList.remove('just-updated'), 700);

        // Lógica de timeout para status offline
        clearTimeout(releUpdateTimers[dados.rele_id]);
        releUpdateTimers[dados.rele_id] = setTimeout(() => {
            statusIndicator.textContent = 'Offline';
            statusIndicator.className = 'status-indicator offline';
            card.className = 'rele-card status-offline';
        }, 180000); // 3 minutos (ajuste conforme o intervalo de polling do seu relé)
    }

    // Inicia o processo
    async function init() {
        await carregarRelesIniciais();
        conectarWebSocket();
    }

    init();
});
