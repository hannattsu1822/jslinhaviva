document.addEventListener('DOMContentLoaded', () => {
    // O RELE_ID é passado do HTML
    if (typeof RELE_ID === 'undefined') {
        console.error('ID do Relé não definido!');
        return;
    }

    let updateTimeout;

    // --- Funções de Atualização da UI ---
    const formatValue = (value, dec, unit = '') => (typeof value === 'number' ? `${value.toFixed(dec)}${unit}` : '-');
    
    function updateLivePanel(data) {
        document.getElementById('live-tensao-a').textContent = formatValue(data.tensao_a, 1);
        document.getElementById('live-tensao-b').textContent = formatValue(data.tensao_b, 1);
        document.getElementById('live-tensao-c').textContent = formatValue(data.tensao_c, 1);
        document.getElementById('live-corrente-a').textContent = formatValue(data.corrente_a, 2);
        document.getElementById('live-corrente-b').textContent = formatValue(data.corrente_b, 2);
        document.getElementById('live-corrente-c').textContent = formatValue(data.corrente_c, 2);
        document.getElementById('live-frequencia').textContent = formatValue(data.frequencia, 2);
        const timestamp = new Date(data.timestamp_leitura);
        document.getElementById('live-timestamp').textContent = `Recebido em: ${timestamp.toLocaleString('pt-BR')}`;
    }

    function addRowToHistory(data) {
        const tableBody = document.getElementById('history-table-body');
        const newRow = document.createElement('tr');
        const timestamp = new Date(data.timestamp_leitura);
        newRow.innerHTML = `
            <td>${timestamp.toLocaleString('pt-BR')}</td>
            <td>${formatValue(data.tensao_a,1)} / ${formatValue(data.tensao_b,1)} / ${formatValue(data.tensao_c,1)}</td>
            <td>${formatValue(data.corrente_a,2)} / ${formatValue(data.corrente_b,2)} / ${formatValue(data.corrente_c,2)}</td>
            <td>${formatValue(data.frequencia, 2)}</td>
        `;
        tableBody.insertBefore(newRow, tableBody.firstChild);
        // Limita o histórico na tela para 100 linhas
        if (tableBody.rows.length > 100) {
            tableBody.deleteRow(100);
        }
    }

    function setStatus(online) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = statusIndicator.querySelector('.status-text');
        if (online) {
            statusIndicator.className = 'status-box status-online';
            statusText.textContent = 'Online';
        } else {
            statusIndicator.className = 'status-box status-offline';
            statusText.textContent = 'Offline';
        }
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => setStatus(false), 180000); // 3 minutos
    }

    // --- Carregamento Inicial ---
    async function loadInitialData() {
        try {
            const [releInfoRes, leiturasRes] = await Promise.all([
                fetch(`/api/reles/${RELE_ID}`),
                fetch(`/api/reles/${RELE_ID}/leituras`)
            ]);
            if (!releInfoRes.ok || !leiturasRes.ok) throw new Error('Falha ao buscar dados iniciais.');

            const releInfo = await releInfoRes.json();
            const leituras = await leiturasRes.json();

            // Popula informações estáticas
            document.getElementById('info-tag').textContent = releInfo.local_tag || 'N/A';
            document.getElementById('info-ip').textContent = `${releInfo.ip_address}:${releInfo.port}`;

            // Popula painel de última leitura e histórico
            const tableBody = document.getElementById('history-table-body');
            tableBody.innerHTML = '';
            if (leituras.length > 0) {
                updateLivePanel(leituras[0]);
                leituras.forEach(addRowToHistory);
            } else {
                tableBody.innerHTML = '<tr><td colspan="4">Nenhum histórico de leitura encontrado.</td></tr>';
            }
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            alert('Não foi possível carregar os dados do relé.');
        }
    }

    // --- Conexão WebSocket ---
    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

        ws.onopen = () => console.log('WebSocket conectado.');
        ws.onerror = (error) => console.error('Erro no WebSocket:', error);
        ws.onclose = () => setTimeout(connectWebSocket, 5000);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // Só atualiza se a mensagem for para ESTE relé
                if (message.type === 'nova_leitura_rele' && message.dados.rele_id == RELE_ID) {
                    updateLivePanel(message.dados);
                    addRowToHistory(message.dados);
                    setStatus(true);
                }
            } catch (e) {
                console.error('Erro ao processar mensagem:', e);
            }
        };
    }

    // --- Iniciar ---
    loadInitialData();
    connectWebSocket();
});
