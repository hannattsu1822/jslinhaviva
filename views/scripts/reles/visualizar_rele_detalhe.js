document.addEventListener('DOMContentLoaded', () => {
    if (typeof RELE_ID === 'undefined') {
        console.error('ID do Relé não definido!');
        return;
    }

    let updateTimeout;
    const MAX_CHART_POINTS = 30; // Número de pontos a serem exibidos no gráfico em tempo real

    // --- Instâncias dos Gráficos ---
    let tensaoChart, correnteChart, temperaturaChart;

    // --- Funções de Formatação e UI ---
    const formatValue = (value, dec, unit = '') => (typeof value === 'number' ? `${value.toFixed(dec)}${unit}` : '-');
    
    function updateLivePanel(data) {
        document.getElementById('live-tensao').textContent = `${formatValue(data.tensao_a, 1)} / ${formatValue(data.tensao_b, 1)} / ${formatValue(data.tensao_c, 1)}`;
        document.getElementById('live-corrente').textContent = `${formatValue(data.corrente_a, 2)} / ${formatValue(data.corrente_b, 2)} / ${formatValue(data.corrente_c, 2)}`;
        document.getElementById('live-frequencia').textContent = formatValue(data.frequencia, 2);
        document.getElementById('live-temp-disp').textContent = formatValue(data.temperatura_dispositivo, 1);
        document.getElementById('live-temp-amb').textContent = formatValue(data.temperatura_ambiente, 1);
        document.getElementById('live-temp-enrol').textContent = formatValue(data.temperatura_enrolamento, 1);
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
        if (tableBody.rows.length > 100) tableBody.deleteRow(100);
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

    // --- Funções dos Gráficos ---
    function createChart(ctx, label, yAxisLabel) {
        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            tooltipFormat: 'dd/MM/yyyy HH:mm:ss',
                            displayFormats: {
                                minute: 'HH:mm'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Horário'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yAxisLabel
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: label,
                        font: { size: 16 }
                    }
                }
            }
        });
    }

    function addDataToChart(chart, label, data, color) {
        let dataset = chart.data.datasets.find(ds => ds.label === label);
        if (!dataset) {
            dataset = {
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color + '33', // Cor com transparência
                tension: 0.1,
                fill: false
            };
            chart.data.datasets.push(dataset);
        }
        dataset.data.push(data);
        if (dataset.data.length > MAX_CHART_POINTS) {
            dataset.data.shift();
        }
    }

    function initializeCharts(leituras) {
        const reversedLeituras = leituras.slice(0, MAX_CHART_POINTS).reverse();
        
        // Gráfico de Tensão
        const tensaoCtx = document.getElementById('tensaoChart').getContext('2d');
        tensaoChart = createChart(tensaoCtx, 'Tensão por Fase', 'Tensão (V)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(tensaoChart, 'Fase A', { x: time, y: d.tensao_a }, '#FF6384');
            addDataToChart(tensaoChart, 'Fase B', { x: time, y: d.tensao_b }, '#36A2EB');
            addDataToChart(tensaoChart, 'Fase C', { x: time, y: d.tensao_c }, '#FFCE56');
        });
        tensaoChart.update();

        // Gráfico de Corrente
        const correnteCtx = document.getElementById('correnteChart').getContext('2d');
        correnteChart = createChart(correnteCtx, 'Corrente por Fase', 'Corrente (A)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(correnteChart, 'Fase A', { x: time, y: d.corrente_a }, '#FF6384');
            addDataToChart(correnteChart, 'Fase B', { x: time, y: d.corrente_b }, '#36A2EB');
            addDataToChart(correnteChart, 'Fase C', { x: time, y: d.corrente_c }, '#FFCE56');
        });
        correnteChart.update();

        // Gráfico de Temperatura
        const tempCtx = document.getElementById('temperaturaChart').getContext('2d');
        temperaturaChart = createChart(tempCtx, 'Temperaturas', 'Graus (°C)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(temperaturaChart, 'Dispositivo', { x: time, y: d.temperatura_dispositivo }, '#4BC0C0');
            addDataToChart(temperaturaChart, 'Ambiente', { x: time, y: d.temperatura_ambiente }, '#9966FF');
            addDataToChart(temperaturaChart, 'Enrolamento', { x: time, y: d.temperatura_enrolamento }, '#FF9F40');
        });
        temperaturaChart.update();
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

            document.getElementById('info-tag').textContent = releInfo.local_tag || 'N/A';
            document.getElementById('info-ip').textContent = `${releInfo.ip_address}:${releInfo.port}`;

            const tableBody = document.getElementById('history-table-body');
            tableBody.innerHTML = '';
            if (leituras.length > 0) {
                updateLivePanel(leituras[0]);
                leituras.forEach(addRowToHistory);
                initializeCharts(leituras); // Inicializa os gráficos com dados históricos
            } else {
                tableBody.innerHTML = '<tr><td colspan="6">Nenhum histórico de leitura encontrado.</td></tr>';
                initializeCharts([]); // Inicializa gráficos vazios
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
                if (message.type === 'nova_leitura_rele' && message.dados.rele_id == RELE_ID) {
                    const data = message.dados;
                    const time = new Date(data.timestamp_leitura).getTime();

                    // Atualiza UI
                    updateLivePanel(data);
                    addRowToHistory(data);
                    setStatus(true);

                    // Atualiza Gráficos
                    addDataToChart(tensaoChart, 'Fase A', { x: time, y: data.tensao_a }, '#FF6384');
                    addDataToChart(tensaoChart, 'Fase B', { x: time, y: data.tensao_b }, '#36A2EB');
                    addDataToChart(tensaoChart, 'Fase C', { x: time, y: data.tensao_c }, '#FFCE56');
                    tensaoChart.update();

                    addDataToChart(correnteChart, 'Fase A', { x: time, y: data.corrente_a }, '#FF6384');
                    addDataToChart(correnteChart, 'Fase B', { x: time, y: data.corrente_b }, '#36A2EB');
                    addDataToChart(correnteChart, 'Fase C', { x: time, y: data.corrente_c }, '#FFCE56');
                    correnteChart.update();

                    addDataToChart(temperaturaChart, 'Dispositivo', { x: time, y: data.temperatura_dispositivo }, '#4BC0C0');
                    addDataToChart(temperaturaChart, 'Ambiente', { x: time, y: data.temperatura_ambiente }, '#9966FF');
                    addDataToChart(temperaturaChart, 'Enrolamento', { x: time, y: data.temperatura_enrolamento }, '#FF9F40');
                    temperaturaChart.update();
                }
            } catch (e) {
                console.error('Erro ao processar mensagem:', e);
            }
        };
    }

    loadInitialData();
    connectWebSocket();
});
