let historicoChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    if (typeof serialNumber === 'undefined') {
        console.error("Serial Number não definido. Verifique o template HTML.");
        return;
    }
    inicializarPainel();
});

function inicializarPainel() {
    iniciarWebSocket();
    carregarLeiturasIniciais();
    carregarStatusInicial();
    carregarEstatisticasDetalhes();
}

function iniciarWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("[WebSocket] Conectado.");
    };

    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            
            // Filtra mensagens apenas deste dispositivo
            if (msg.dados && msg.dados.serial_number && msg.dados.serial_number !== serialNumber) {
                return;
            }

            if (msg.type === "nova_leitura_logbox" || msg.type === "nova_leitura") {
                atualizarPainelLeitura(msg.dados);
            } else if (msg.type === "atualizacao_status") {
                atualizarPainelCompleto(msg.dados);
            }
        } catch (e) {
            console.error("[WebSocket] Erro ao processar mensagem:", e);
        }
    };

    socket.onclose = (event) => {
        console.warn("[WebSocket] Desconectado. Código:", event.code);
        // Tenta reconectar em 5 segundos
        setTimeout(iniciarWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error("[WebSocket] Erro:", error);
        socket.close();
    };
}

async function carregarLeiturasIniciais() {
    const loader = document.getElementById("loader-historico");
    const chartContainer = document.getElementById("graficoHistorico");

    try {
        if (loader) loader.style.display = "block";
        if (chartContainer) chartContainer.style.display = "none";

        const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        gerarGraficoHistorico(data);

        if (loader) loader.style.display = "none";
        if (chartContainer) chartContainer.style.display = "block";
    } catch (error) {
        console.error("Erro ao carregar leituras:", error);
        if (loader) {
            loader.innerHTML = `<p class="has-text-danger has-text-centered py-6">Erro ao carregar dados.</p>`;
        }
    }
}

async function carregarStatusInicial() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
        if (!response.ok) throw new Error("Falha ao buscar status");

        const data = await response.json();
        const statusData = data.status || data;

        atualizarPainelCompleto(statusData);
        carregarUltimaLeitura();
    } catch (error) {
        console.error("Erro ao carregar status:", error);
    }
}

async function carregarUltimaLeitura() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/latest`);
        if (response.ok) {
            const latest = await response.json();
            if (latest && latest.payload) {
                const payload = JSON.parse(latest.payload);
                const temp = extrairTemperatura(payload);

                if (temp !== null) {
                    atualizarElementoTexto("latest-temp", temp.toFixed(1));
                }
                atualizarElementoTexto("latest-timestamp", `Em: ${new Date(latest.timestamp_leitura).toLocaleString("pt-BR")}`);
            }
        }
    } catch (e) {
        console.error("Erro ao carregar última leitura:", e);
    }
}

async function carregarEstatisticasDetalhes() {
    try {
        const res = await fetch(`/api/logbox-device/${serialNumber}/stats-detail`);
        if (res.ok) {
            const stats = await res.json();
            atualizarElementoTexto("stat-today-min", `${stats.today.min} °C`);
            atualizarElementoTexto("stat-today-avg", `${stats.today.avg} °C`);
            atualizarElementoTexto("stat-today-max", `${stats.today.max} °C`);
        }
    } catch (e) {
        console.error("Erro stats:", e);
    }
}

function atualizarPainelCompleto(status) {
    if (!status) return;

    const connectionStatusEl = document.getElementById("connection-status-text");
    if (connectionStatusEl) {
        const isOnline = status.connection_status !== "offline";
        connectionStatusEl.textContent = isOnline ? "Online" : "Offline";
        connectionStatusEl.className = isOnline ? "title is-4 has-text-success" : "title is-4 has-text-danger";
    }

    const wifiInfo = getWifiStatus(status.lqi);
    atualizarElementoTexto("diag-wifi-rssi", `RSSI: ${status.lqi || "--"} dBm (${wifiInfo.text})`);
    
    const powerInfo = getPowerSourceStatus(status.ch_analog_2);
    atualizarElementoTexto("diag-power-source", powerInfo.text);

    const bateria = status.ch_analog_3 || status.battery;
    atualizarElementoTexto("diag-battery-voltage", `Bateria: ${bateria ? bateria.toFixed(2) : "--"} V`);

    atualizarElementoTexto("diag-internal-temp", `${status.temperature ? status.temperature.toFixed(1) : "--"} °C`);
    atualizarElementoTexto("diag-ip-address", status.ip || "--");
    atualizarElementoTexto("diag-firmware-version", status.firmware_version || "--");

    atualizarListaAlarmes(status.alarms);
}

function atualizarPainelLeitura(dados) {
    const temperatura = extrairTemperatura(dados);

    if (temperatura !== undefined && temperatura !== null) {
        const tempElement = document.getElementById("latest-temp");
        if (tempElement) {
            tempElement.textContent = temperatura.toFixed(1);
            animarAtualizacao(tempElement.closest(".box"));
        }

        atualizarGraficoTempoReal(temperatura);
    }

    atualizarElementoTexto("latest-timestamp", `Em: ${new Date().toLocaleString("pt-BR")}`);

    if (dados.ch_analog_2 !== undefined) {
        const powerInfo = getPowerSourceStatus(dados.ch_analog_2);
        atualizarElementoTexto("diag-power-source", powerInfo.text);
    }
}

function extrairTemperatura(dados) {
    if (dados.ch_analog_1 !== undefined) return dados.ch_analog_1;
    if (dados.value_channels && Array.isArray(dados.value_channels)) return dados.value_channels[2];
    return null;
}

function atualizarGraficoTempoReal(temperatura) {
    if (!historicoChartInstance) return;

    const now = new Date().getTime();
    const option = historicoChartInstance.getOption();

    if (option && option.series && option.series[0]) {
        const data = option.series[0].data;
        data.push([now, temperatura]);
        
        // Mantém apenas os últimos 200 pontos para performance
        if (data.length > 200) data.shift();

        historicoChartInstance.setOption({
            series: [{ data: data }]
        });
    }
}

function gerarGraficoHistorico(dados) {
    const container = document.getElementById("graficoHistorico");
    if (!container || !dados.labels || dados.labels.length === 0) {
        if (container) container.innerHTML = '<p class="has-text-centered py-6">Sem dados históricos disponíveis.</p>';
        return;
    }

    if (historicoChartInstance) {
        historicoChartInstance.dispose();
    }

    const chartData = dados.labels.map((label, index) => {
        const timestamp = parseDataBr(label);
        return [timestamp, dados.temperaturas[index]];
    });

    historicoChartInstance = echarts.init(container);

    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: params => {
                if (!params[0]) return '';
                const d = new Date(params[0].value[0]);
                return `${d.toLocaleString("pt-BR")}<br/>Temp: <strong>${params[0].value[1].toFixed(1)} °C</strong>`;
            }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'time',
            boundaryGap: false,
            axisLabel: {
                formatter: value => {
                    const date = new Date(value);
                    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: { formatter: '{value} °C' },
            scale: true
        },
        series: [{
            name: 'Temperatura',
            type: 'line',
            smooth: true,
            showSymbol: false,
            data: chartData,
            lineStyle: { color: '#3273dc', width: 2 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(50, 115, 220, 0.3)' },
                    { offset: 1, color: 'rgba(50, 115, 220, 0.05)' }
                ])
            }
        }]
    };

    historicoChartInstance.setOption(option);
    window.addEventListener("resize", () => historicoChartInstance && historicoChartInstance.resize());
}

function atualizarListaAlarmes(alarms) {
    const countEl = document.getElementById("active-alarms-count");
    const subEl = document.getElementById("alarm-subtitle");
    
    if (!countEl) return;

    let activeCount = 0;
    if (alarms) {
        activeCount = Array.isArray(alarms) 
            ? alarms.filter(a => a === 1).length 
            : Object.values(alarms).filter(v => v === true).length;
    }

    countEl.textContent = activeCount;
    if (subEl) subEl.textContent = activeCount > 0 ? `${activeCount} alarme(s) ativo(s)` : "Nenhum alarme";
}

function atualizarElementoTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
}

function animarAtualizacao(elemento) {
    if (elemento) {
        elemento.style.transition = "background-color 0.5s";
        elemento.style.backgroundColor = "#e3f2fd";
        setTimeout(() => elemento.style.backgroundColor = "", 500);
    }
}

function getWifiStatus(rssi) {
    if (!rssi) return { text: "Sem Sinal" };
    if (rssi >= -67) return { text: "Excelente" };
    if (rssi >= -75) return { text: "Bom" };
    if (rssi >= -85) return { text: "Fraco" };
    return { text: "Muito Fraco" };
}

function getPowerSourceStatus(voltage) {
    if (voltage === undefined || voltage === null) return { text: "Verificando..." };
    return voltage > 9 ? { text: "Rede Elétrica" } : { text: "Apenas Bateria" };
}

function parseDataBr(dataString) {
    if (dataString.includes('/')) {
        const parts = dataString.split(/[\/\s:]/);
        // Formato esperado: DD/MM/YYYY HH:mm:ss
        return new Date(parts[2], parts[1] - 1, parts[0], parts[3] || 0, parts[4] || 0, parts[5] || 0).getTime();
    }
    return new Date(dataString).getTime();
}
