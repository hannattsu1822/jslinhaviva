document.addEventListener('DOMContentLoaded', () => {
    if (typeof RELE_ID === 'undefined') {
        console.error('ID do Relé não definido!');
        return;
    }

    let updateTimeout;

    const formatValue = (value, dec, unit = '') => (typeof value === 'number' ? `${value.toFixed(dec)}${unit}` : '-');
    
    function updateLivePanel(data) {
        // Medições Elétricas
        document.getElementById('live-tensao').textContent = `${formatValue(data.tensao_a, 1)} / ${formatValue(data.tensao_b, 1)} / ${formatValue(data.tensao_c, 1)}`;
        document.getElementById('live-corrente').textContent = `${formatValue(data.corrente_a, 2)} / ${formatValue(data.corrente_b, 2)} / ${formatValue(data.corrente_c, 2)}`;
        document.getElementById('live-frequencia').textContent = formatValue(data.frequencia, 2);

        // Temperaturas
        document.getElementById('live-temp-disp').textContent = formatValue(data.temperatura_dispositivo, 1);
        document.getElementById('live-temp-amb').textContent = formatValue(data.temperatura_ambiente, 1);
        document.getElementById('live-temp-enrol').textContent = formatValue(data.temperatura_enrolamento, 1);

        // Status
        const targetEl = document.getElementById('live-target');
        const selfTestEl = document.getElementById('live-selftest');
        const alarmEl = document.getElementById('live-alarm');

        targetEl.textContent = data.target_status || '-';
        selfTestEl.textContent = data.self_test_status || '-';
        alarmEl.textContent = data.alarm_status || '-';

        selfTestEl.className = `value status-text ${data.self_test_status === 'OK' ? 'ok' : 'fail'}`;
        alarmEl.className = `value status-text ${data.alarm_status === 'NO ALARM' ? 'ok' : 'alarm'}`;

        // Timestamp
        const timestamp = new Date(data.timestamp_leitura);
        document.getElementById('live-timestamp').textContent = `Recebido em: ${timestamp.toLocaleString('pt-BR')}`;
    }

    function addRowToHistory(data) {
        const tableBody = document.getElementById('history-table-body');
        const newRow = document.createElement('tr');
        const timestamp = new Date(data.timestamp_leitura);

        const tensaoStr = `${formatValue(data.tensao_a,1)}/${formatValue(data.tensao_b,1)}/${formatValue(data.tensao_c,1)}`;
        const correnteStr = `${formatValue(data.corrente_a,2)}/${formatValue(data.corrente_b,2)}/${formatValue(data.corrente_c,2)}`;
        const statusStr = `${data.target_status || '-'}/${data.self_test_status || '-'}/${data.alarm_status || '-'}`;
        const tempStr = `${formatValue(data.temperatura_dispositivo,1)}/${formatValue(data.temperatura_ambiente,1)}/${formatValue(data.temperatura_enrolamento,1)}`;

        newRow.innerHTML = `
            <td>${timestamp.toLocaleString('pt-BR')}</td>
            <td>${tensaoStr}</td>
            <td>${correnteStr}</td>
            <td>${formatValue(data.frequencia, 2)}</td>
            <td>${statusStr}</td>
            <td>${tempStr}</td>
        `;
        tableBody.insertBefore(newRow, tableBody.firstChild);
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
        updateTimeout = setTimeout(() => setStatus(false), 180000);
    }

    async function loadInitialData() {
        try {
            const [releInfoRes, leiturasRes] = await Promise.all([
                fetch(`/api/reles/${RELE_ID}`),
                fetch(`/api/reles/${RELE_ID}/leituras`)
            ]);
            if (!releInfoRes.ok || !leiturasRes.ok) throw new Error('Falha ao buscar dados iniciais.');

            const releInfo = await releInfoRes.json();
            const leituras = await leiturasRes.json();

            document.getElementById('info-tag').textContent = releInfo.local_tag || 'N/A';
            document.getElementById('info-ip').textContent = `${releInfo.ip_address}:${releInfo.port}`;

            const tableBody = document.getElementById('history-table-body');
            tableBody.innerHTML = '';
            if (leituras.length > 0) {
                updateLivePanel(leituras[0]);
                leituras.forEach(addRowToHistory);
            } else {
                tableBody.innerHTML = '<tr><td colspan="6">Nenhum histórico de leitura encontrado.</td></tr>';
            }
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            alert('Não foi possível carregar os dados do relé.');
        }
    }

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

        ws.onopen = () => console.log('WebSocket conectado.');
        ws.onerror = (error) => console.error('Erro no WebSocket:', error);
        ws.onclose = () => setTimeout(connectWebSocket, 5000);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
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

    loadInitialData();
    connectWebSocket();
});
