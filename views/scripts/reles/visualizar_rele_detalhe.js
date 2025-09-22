document.addEventListener('DOMContentLoaded', () => {
    const RELE_ID = parseInt(window.location.pathname.split('/').pop(), 10);

    const elements = {
        statusIndicator: document.getElementById('status-indicator'),
        statusText: document.querySelector('#status-indicator .status-text'),
        timestamp: document.getElementById('live-timestamp'),
        tensaoVA: document.getElementById('live-tensao-va'),
        tensaoVB: document.getElementById('live-tensao-vb'),
        tensaoVC: document.getElementById('live-tensao-vc'),
        tensaoVAB: document.getElementById('live-tensao-vab'),
        tensaoVBC: document.getElementById('live-tensao-vbc'),
        tensaoVCA: document.getElementById('live-tensao-vca'),
        correnteA: document.getElementById('live-corrente-a'),
        correnteB: document.getElementById('live-corrente-b'),
        correnteC: document.getElementById('live-corrente-c'),
        tempDisp: document.getElementById('live-temp-disp'),
        tempAmb: document.getElementById('live-temp-amb'),
        tempEnrol: document.getElementById('live-temp-enrol'),
    };

    let tensaoChart, correnteChart, temperaturaChart;

    function updateUI(data) {
        if (!data) {
            return;
        }

        elements.statusIndicator.className = 'status-box status-online';
        elements.statusText.textContent = 'Online';

        const dataLeitura = new Date(data.timestamp);
        elements.timestamp.textContent = `Última leitura: ${dataLeitura.toLocaleString('pt-BR')}`;

        const formatValue = (value, unit = '') => (value !== null && value !== undefined) ? `${parseFloat(value).toFixed(2)}${unit}` : '-';
        
        updateCardValue(elements.tensaoVA, formatValue(data.dados.tensao_rn, ' V'));
        updateCardValue(elements.tensaoVB, formatValue(data.dados.tensao_sn, ' V'));
        updateCardValue(elements.tensaoVC, formatValue(data.dados.tensao_tn, ' V'));
        updateCardValue(elements.tensaoVAB, formatValue(data.dados.tensao_rs / 1000, ' kV'));
        updateCardValue(elements.tensaoVBC, formatValue(data.dados.tensao_st / 1000, ' kV'));
        updateCardValue(elements.tensaoVCA, formatValue(data.dados.tensao_tr / 1000, ' kV'));
        updateCardValue(elements.correnteA, formatValue(data.dados.corrente_r, ' A'));
        updateCardValue(elements.correnteB, formatValue(data.dados.corrente_s, ' A'));
        updateCardValue(elements.correnteC, formatValue(data.dados.corrente_t, ' A'));
        updateCardValue(elements.tempDisp, formatValue(data.dados.temperatura, ' °C'));
    }

    function updateCardValue(element, value) {
        if (element.textContent !== value) {
            element.textContent = value;
            const card = element.closest('.live-card');
            if (card) {
                card.classList.remove('just-updated');
                void card.offsetWidth;
                card.classList.add('just-updated');
            }
        }
    }

    function setupWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

        ws.onopen = () => console.log('[WebSocket] Conectado.');
        ws.onclose = () => {
            console.log('[WebSocket] Desconectado. Tentando reconectar em 5 segundos...');
            setTimeout(setupWebSocket, 5000);
        };
        ws.onerror = (error) => console.error('[WebSocket] Erro:', error);

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'nova_leitura_rele' && message.dados && message.dados.rele_id === RELE_ID) {
                    console.log('Recebida leitura para este relé:', message.dados);
                    updateUI(message.dados);
                    addDataToCharts(message.dados);
                }
            } catch (e) {
                console.error('Erro ao processar mensagem do WebSocket:', e);
            }
        };
    }
    
    async function initializeCharts() {
        try {
            const response = await fetch(`/api/reles/${RELE_ID}/leituras?limit=200`);
            if (!response.ok) throw new Error('Falha ao buscar dados históricos');
            
            const historico = await response.json();

            const labels = historico.map(d => new Date(d.timestamp_leitura));

            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: { unit: 'minute' },
                        title: { display: true, text: 'Horário' }
                    },
                    y: {
                        beginAtZero: false,
                        title: { display: true }
                    }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            };

            const tensaoCtx = document.getElementById('tensaoChart').getContext('2d');
            tensaoChart = new Chart(tensaoCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Tensão VA (V)', data: historico.map(d => d.tensao_va), borderColor: '#FFC107', tension: 0.1 },
                        { label: 'Tensão VB (V)', data: historico.map(d => d.tensao_vb), borderColor: '#FF8F00', tension: 0.1 },
                        { label: 'Tensão VC (V)', data: historico.map(d => d.tensao_vc), borderColor: '#ff7e5f', tension: 0.1 }
                    ]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { ...commonOptions.scales.y.title, text: 'Tensão (V)' } } } }
            });

            const correnteCtx = document.getElementById('correnteChart').getContext('2d');
            correnteChart = new Chart(correnteCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Corrente A (A)', data: historico.map(d => d.corrente_a), borderColor: '#2196F3', tension: 0.1 },
                        { label: 'Corrente B (A)', data: historico.map(d => d.corrente_b), borderColor: '#0D47A1', tension: 0.1 },
                        { label: 'Corrente C (A)', data: historico.map(d => d.corrente_c), borderColor: '#64b5f6', tension: 0.1 }
                    ]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { ...commonOptions.scales.y.title, text: 'Corrente (A)' } } } }
            });

            const temperaturaCtx = document.getElementById('temperaturaChart').getContext('2d');
            temperaturaChart = new Chart(temperaturaCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Ambiente (°C)', data: historico.map(d => d.temperatura_ambiente), borderColor: '#F44336', tension: 0.1 },
                        { label: 'Enrolamento (°C)', data: historico.map(d => d.temperatura_enrolamento), borderColor: '#B71C1C', tension: 0.1 },
                        { label: 'Dispositivo (°C)', data: historico.map(d => d.temperatura_dispositivo), borderColor: '#d32f2f', tension: 0.1 }
                    ]
                },
                options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { ...commonOptions.scales.y.title, text: 'Temperatura (°C)' } } } }
            });

        } catch (error) {
            console.error("Erro ao inicializar gráficos:", error);
        }
    }

    function addDataToCharts(data) {
        if (!tensaoChart) return;
        
        const charts = [tensaoChart, correnteChart, temperaturaChart];
        const timestamp = new Date(data.timestamp);

        charts.forEach(chart => {
            if (chart) {
                chart.data.labels.push(timestamp);
                if (chart.data.labels.length > 200) {
                    chart.data.labels.shift();
                }
            }
        });

        tensaoChart.data.datasets[0].data.push(data.dados.tensao_rn);
        tensaoChart.data.datasets[1].data.push(data.dados.tensao_sn);
        tensaoChart.data.datasets[2].data.push(data.dados.tensao_tn);

        correnteChart.data.datasets[0].data.push(data.dados.corrente_r);
        correnteChart.data.datasets[1].data.push(data.dados.corrente_s);
        correnteChart.data.datasets[2].data.push(data.dados.corrente_t);

        temperaturaChart.data.datasets[2].data.push(data.dados.temperatura);

        charts.forEach(chart => {
            chart.data.datasets.forEach(dataset => {
                if (dataset.data.length > 200) {
                    dataset.data.shift();
                }
            });
            chart.update();
        });
    }
    
    if (typeof DADOS_INICIAIS !== 'undefined' && DADOS_INICIAIS) {
        updateUI(DADOS_INICIAIS);
    }

    initializeCharts();

    setupWebSocket();
});
