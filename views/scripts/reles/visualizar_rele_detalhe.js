document.addEventListener('DOMContentLoaded', () => {
    if (typeof RELE_ID === 'undefined') {
        console.error('ID do Relé não definido!');
        return;
    }

    let updateTimeout;
    const MAX_CHART_POINTS = 60;
    // O intervalo para considerar um relé offline (em milissegundos).
    // 5 minutos do polling + 30s de margem = 330000ms
    const OFFLINE_THRESHOLD_MS = 330000;
    let tensaoChart, correnteChart, temperaturaChart;

    const formatValue = (value, dec) => (typeof value === 'number' ? value.toFixed(dec) : '-');
    
    function updateLiveCards(data) {
        document.getElementById('live-tensao-va').textContent = formatValue(data.tensao_va, 2);
        document.getElementById('live-tensao-vb').textContent = formatValue(data.tensao_vb, 2);
        document.getElementById('live-tensao-vc').textContent = formatValue(data.tensao_vc, 2);
        document.getElementById('live-tensao-vab').textContent = formatValue(data.tensao_vab, 2);
        document.getElementById('live-tensao-vbc').textContent = formatValue(data.tensao_vbc, 2);
        document.getElementById('live-tensao-vca').textContent = formatValue(data.tensao_vca, 2);
        document.getElementById('live-corrente-a').textContent = formatValue(data.corrente_a, 2);
        document.getElementById('live-corrente-b').textContent = formatValue(data.corrente_b, 2);
        document.getElementById('live-corrente-c').textContent = formatValue(data.corrente_c, 2);
        document.getElementById('live-temp-disp').textContent = formatValue(data.temperatura_dispositivo, 2);
        document.getElementById('live-temp-amb').textContent = formatValue(data.temperatura_ambiente, 2);
        document.getElementById('live-temp-enrol').textContent = formatValue(data.temperatura_enrolamento, 2);
        
        const timestamp = new Date(data.timestamp_leitura);
        document.getElementById('live-timestamp').textContent = `Última leitura: ${timestamp.toLocaleString('pt-BR')}`;
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
        if (online) {
            updateTimeout = setTimeout(() => setStatus(false), OFFLINE_THRESHOLD_MS);
        }
    }

    function createProfessionalChart(ctx, label, yAxisLabel) {
        return new Chart(ctx, {
            type: 'line',
            data: { datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { type: 'time', time: { unit: 'minute', tooltipFormat: 'dd/MM/yyyy HH:mm:ss', displayFormats: { minute: 'HH:mm' } }, grid: { display: false } },
                    y: { title: { display: true, text: yAxisLabel }, grid: { color: '#f0f0f0' } }
                },
                plugins: {
                    title: { display: true, text: label, font: { size: 18, weight: 'bold' }, padding: { bottom: 20 } },
                    legend: { position: 'bottom' },
                    tooltip: { backgroundColor: '#fff', titleColor: '#333', bodyColor: '#666', borderColor: '#ddd', borderWidth: 1, padding: 10, displayColors: true }
                }
            }
        });
    }

    function addDataToChart(chart, label, data, color) {
        let dataset = chart.data.datasets.find(ds => ds.label === label);
        if (!dataset) {
            const gradient = chart.ctx.createLinearGradient(0, 0, 0, chart.height);
            gradient.addColorStop(0, color + '66');
            gradient.addColorStop(1, color + '00');

            dataset = {
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: gradient,
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5
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
        
        const tensaoCtx = document.getElementById('tensaoChart');
        tensaoChart = createProfessionalChart(tensaoCtx, 'Tensão (Fase e Linha)', 'Tensão (V)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(tensaoChart, 'Fase VA', { x: time, y: d.tensao_va }, '#FF6384');
            addDataToChart(tensaoChart, 'Fase VB', { x: time, y: d.tensao_vb }, '#36A2EB');
            addDataToChart(tensaoChart, 'Fase VC', { x: time, y: d.tensao_vc }, '#FFCE56');
            addDataToChart(tensaoChart, 'Linha VAB', { x: time, y: d.tensao_vab }, '#e83e5c');
            addDataToChart(tensaoChart, 'Linha VBC', { x: time, y: d.tensao_vbc }, '#2aa0e0');
            addDataToChart(tensaoChart, 'Linha VCA', { x: time, y: d.tensao_vca }, '#e6bc4c');
        });
        tensaoChart.update();

        const correnteCtx = document.getElementById('correnteChart');
        correnteChart = createProfessionalChart(correnteCtx, 'Corrente por Fase', 'Corrente (A)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(correnteChart, 'Corrente A', { x: time, y: d.corrente_a }, '#FF6384');
            addDataToChart(correnteChart, 'Corrente B', { x: time, y: d.corrente_b }, '#36A2EB');
            addDataToChart(correnteChart, 'Corrente C', { x: time, y: d.corrente_c }, '#FFCE56');
        });
        correnteChart.update();

        const tempCtx = document.getElementById('temperaturaChart');
        temperaturaChart = createProfessionalChart(tempCtx, 'Temperaturas', 'Graus (°C)');
        reversedLeituras.forEach(d => {
            const time = new Date(d.timestamp_leitura).getTime();
            addDataToChart(temperaturaChart, 'Dispositivo', { x: time, y: d.temperatura_dispositivo }, '#4BC0C0');
            addDataToChart(temperaturaChart, 'Ambiente', { x: time, y: d.temperatura_ambiente }, '#9966FF');
            addDataToChart(temperaturaChart, 'Enrolamento', { x: time, y: d.temperatura_enrolamento }, '#FF9F40');
        });
        temperaturaChart.update();
    }

    async function loadInitialData() {
        try {
            const leiturasRes = await fetch(`/api/reles/${RELE_ID}/leituras`);
            if (!leiturasRes.ok) throw new Error('Falha ao buscar dados iniciais.');
            const leituras = await leiturasRes.json();

            // Se existirem dados históricos, preenche a tela com o mais recente
            if (leituras.length > 0) {
                updateLiveCards(leituras[0]);
                
                // Verifica se o último dado é recente para definir o status inicial
                const lastTimestamp = new Date(leituras[0].timestamp_leitura).getTime();
                const isOnline = (Date.now() - lastTimestamp) < OFFLINE_THRESHOLD_MS;
                setStatus(isOnline);

                initializeCharts(leituras);
            } else {
                // Se não houver dados, inicializa os gráficos vazios e define como offline
                initializeCharts([]);
                setStatus(false);
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
                    const data = message.dados;
                    const time = new Date(data.timestamp_leitura).getTime();
                    
                    // Atualiza os cards e define o status como Online
                    updateLiveCards(data);
                    setStatus(true);

                    // Adiciona os novos dados aos gráficos
                    addDataToChart(tensaoChart, 'Fase VA', { x: time, y: data.tensao_va }, '#FF6384');
                    addDataToChart(tensaoChart, 'Fase VB', { x: time, y: data.tensao_vb }, '#36A2EB');
                    addDataToChart(tensaoChart, 'Fase VC', { x: time, y: data.tensao_vc }, '#FFCE56');
                    addDataToChart(tensaoChart, 'Linha VAB', { x: time, y: data.tensao_vab }, '#e83e5c');
                    addDataToChart(tensaoChart, 'Linha VBC', { x: time, y: data.tensao_vbc }, '#2aa0e0');
                    addDataToChart(tensaoChart, 'Linha VCA', { x: time, y: data.tensao_vca }, '#e6bc4c');
                    tensaoChart.update('none');

                    addDataToChart(correnteChart, 'Corrente A', { x: time, y: data.corrente_a }, '#FF6384');
                    addDataToChart(correnteChart, 'Corrente B', { x: time, y: data.corrente_b }, '#36A2EB');
                    addDataToChart(correnteChart, 'Corrente C', { x: time, y: data.corrente_c }, '#FFCE56');
                    correnteChart.update('none');

                    addDataToChart(temperaturaChart, 'Dispositivo', { x: time, y: data.temperatura_dispositivo }, '#4BC0C0');
                    addDataToChart(temperaturaChart, 'Ambiente', { x: time, y: data.temperatura_ambiente }, '#9966FF');
                    addDataToChart(temperaturaChart, 'Enrolamento', { x: time, y: data.temperatura_enrolamento }, '#FF9F40');
                    temperaturaChart.update('none');
                }
            } catch (e) { console.error('Erro ao processar mensagem:', e); }
        };
    }

    loadInitialData();
    connectWebSocket();
});
