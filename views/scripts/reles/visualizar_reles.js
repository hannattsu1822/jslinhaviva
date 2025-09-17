document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('reles-dashboard');
    const loadingMessage = document.getElementById('loading-message');
    const releUpdateTimers = {};

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

    // --- FUNÇÃO ATUALIZADA E MAIS ROBUSTA ---
    function atualizarCard(dados) {
        const card = document.getElementById(`rele-card-${dados.rele_id}`);
        if (!card) return;

        // Função auxiliar para formatar valores de forma segura
        const formatValue = (value, decimalPlaces, defaultValue = '-') => {
            if (typeof value === 'number' && !isNaN(value)) {
                return value.toFixed(decimalPlaces);
            }
            return defaultValue;
        };

        // Atualiza os valores usando a função segura
        const tensaoEl = document.getElementById(`tensao-${dados.rele_id}`);
        const correnteEl = document.getElementById(`corrente-${dados.rele_id}`);
        
        const t_a = formatValue(dados.tensao_a, 1);
        const t_b = formatValue(dados.tensao_b, 1);
        const t_c = formatValue(dados.tensao_c, 1);
        tensaoEl.textContent = `${t_a} | ${t_b} | ${t_c}`;

        const c_a = formatValue(dados.corrente_a, 2);
        const c_b = formatValue(dados.corrente_b, 2);
        const c_c = formatValue(dados.corrente_c, 2);
        correnteEl.textContent = `${c_a} | ${c_b} | ${c_c}`;
        
        document.getElementById(`frequencia-${dados.rele_id}`).textContent = formatValue(dados.frequencia, 2);
        
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
        }, 180000); // 3 minutos
    }

    async function init() {
        await carregarRelesIniciais();
        conectarWebSocket();
    }

    init();
});
