let historicoChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    inicializarPainel();
});

function inicializarPainel() {
    Promise.all([
        carregarLeiturasIniciais(),
        carregarStatusInicial(),
        carregarEstatisticasDetalhes(),
    ]).then(() => {
        iniciarWebSocket();
    }).catch((error) => {
        const loader = document.getElementById("loader-historico");
        if (loader) {
            loader.innerHTML = "<span>Erro ao carregar dados. Tente recarregar a página.</span>";
        }
    });
}

async function carregarLeiturasIniciais() {
    const loader = document.getElementById("loader-historico");
    const canvas = document.getElementById("graficoHistorico");
    try {
        if (loader) loader.style.display = "flex";
        const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
        if (!response.ok) throw new Error("Falha ao buscar histórico de leituras");

        const data = await response.json();
        gerarGraficoHistorico(data);
        if (loader) loader.style.display = "none";
        if (canvas) canvas.style.display = "block";
    } catch (error) {
        if (loader) loader.innerHTML = "<span>Erro ao carregar o gráfico.</span>";
        throw error;
    }
}

async function carregarStatusInicial() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
        if (!response.ok) throw new Error("Falha ao buscar status do dispositivo");

        const data = await response.json();
        atualizarPainelCompleto(data.status);

        const latestReadingResponse = await fetch(`/api/logbox-device/${serialNumber}/latest`);
        if (latestReadingResponse.ok) {
            const latestData = await latestReadingResponse.json();
            const payloadObjeto = JSON.parse(latestData.payload);
            const tempExterna = payloadObjeto.ch_analog_1 || (payloadObjeto.value_channels ? payloadObjeto.value_channels[2] : undefined);

            if (tempExterna !== undefined) {
                document.getElementById("latest-temp").textContent = tempExterna.toFixed(1);
            }
            document.getElementById("latest-timestamp").textContent = `Em: ${new Date(latestData.timestamp_leitura).toLocaleString("pt-BR")}`;
        }
    } catch (error) {
        throw error;
    }
}

function atualizarPainelCompleto(status) {
    if (!status || Object.keys(status).length === 0) return;

    const connectionStatusEl = document.getElementById("connection-status-text");
    if (status.connection_status === "offline") {
        connectionStatusEl.textContent = "Offline";
        connectionStatusEl.className = "kpi-value text-danger";
    } else {
        connectionStatusEl.textContent = "Online";
        connectionStatusEl.className = "kpi-value text-success";
    }

    const sinalWifi = status.lqi;
    const { text: wifiText } = getWifiStatus(sinalWifi);
    document.getElementById("diag-wifi-rssi").textContent = `RSSI: ${sinalWifi || "--"} dBm (${wifiText})`;

    const tensaoFonteExterna = status.ch_analog_2;
    const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
    document.getElementById("diag-power-source").textContent = powerText;

    const tensaoBateria = status.ch_analog_3 || status.battery;
    document.getElementById("diag-battery-voltage").textContent = `Bateria: ${tensaoBateria?.toFixed(2) || "--"} V`;

    const temperaturaInterna = status.temperature;
    atualizarBadge("diag-internal-temp", `${temperaturaInterna?.toFixed(1) || "--"} °C`, "text-bg-info");

    atualizarBadge("diag-pt100-status", "N/A via MQTT", "text-bg-secondary");
    
    const ipAddress = status.ip;
    atualizarBadge("diag-ip-address", ipAddress || "--", "text-bg-secondary");

    const firmwareVersion = status.firmware_version;
    atualizarBadge("diag-firmware-version", firmwareVersion || "--", "text-bg-secondary");

    atualizarListaAlarmes(status.alarms);
}

function atualizarPainelLeitura(dados) {
    const temperatura = dados.ch_analog_1;
    if (temperatura !== undefined) {
        document.getElementById("latest-temp").textContent = temperatura.toFixed(1);
    }
    document.getElementById("latest-timestamp").textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;

    if (historicoChartInstance) {
        historicoChartInstance.data.datasets[0].data.push({
            x: new Date(),
            y: temperatura,
        });
        historicoChartInstance.update("quiet");
    }

    const tensaoFonteExterna = dados.ch_analog_2;
    const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
    document.getElementById("diag-power-source").textContent = powerText;

    const tensaoBateria = dados.ch_analog_3 || dados.battery;
    document.getElementById("diag-battery-voltage").textContent = `Bateria: ${tensaoBateria?.toFixed(2) || "--"} V`;

    carregarEstatisticasDetalhes();
}

function atualizarBadge(elementId, text, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        element.className = `badge ${className}`;
    }
}

function atualizarListaAlarmes(alarms) {
    const alarmCountEl = document.getElementById("active-alarms-count");
    const alarmSubtextEl = alarmCountEl.nextElementSibling;
    if (!alarms) {
        alarmCountEl.textContent = "0";
        alarmSubtextEl.textContent = "Nenhum alarme no momento";
        return;
    }

    let activeAlarms = [];
    if (Array.isArray(alarms)) {
        const alarmNames = ["A1.L", "A1.H", "A2.L", "A2.H", "A3.L", "A3.H", "D1.H"];
        alarms.forEach((status, index) => {
            if (status === 1 && alarmNames[index]) {
                activeAlarms.push([alarmNames[index], true]);
            }
        });
    } else {
        activeAlarms = Object.entries(alarms).filter(([key, value]) => value === true);
    }

    alarmCountEl.textContent = activeAlarms.length;
    if (activeAlarms.length > 0) {
        alarmSubtextEl.textContent = `${activeAlarms.length} alarme(s) ativo(s)`;
    } else {
        alarmSubtextEl.textContent = "Nenhum alarme no momento";
    }
}

function iniciarWebSocket() {
    const socket = new WebSocket(`ws://${window.location.host}`);

    socket.onopen = () => {};
    socket.onclose = () => {
        setTimeout(iniciarWebSocket, 5000);
    };
    socket.onerror = (error) => {};

    socket.onmessage = function (event) {
        try {
            const message = JSON.parse(event.data);
            if (message.dados && message.dados.serial_number !== serialNumber) {
                return;
            }
            if (message.type === "nova_leitura_logbox") {
                atualizarPainelLeitura(message.dados);
            }
            if (message.type === "atualizacao_status") {
                atualizarPainelCompleto(message.dados);
            }
        } catch (e) {}
    };
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
    if (voltage > 9) return { text: "Rede Elétrica" };
    return { text: "Apenas Bateria" };
}

async function carregarEstatisticasDetalhes() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/stats-detail`);
        if (!response.ok) throw new Error("Falha ao buscar estatísticas");
        const stats = await response.json();

        document.getElementById("stat-today-min").textContent = `${stats.today.min} °C`;
        document.getElementById("stat-today-avg").textContent = `${stats.today.avg} °C`;
        document.getElementById("stat-today-max").textContent = `${stats.today.max} °C`;
        document.getElementById("stat-month-min").textContent = `${stats.month.min} °C`;
        document.getElementById("stat-month-avg").textContent = `${stats.month.avg} °C`;
        document.getElementById("stat-month-max").textContent = `${stats.month.max} °C`;
    } catch (error) {}
}

function gerarGraficoHistorico(dados) {
    const ctxEl = document.getElementById("graficoHistorico");
    if (!ctxEl) return;
    const ctx = ctxEl.getContext("2d");

    const initialData = dados.labels.map((label, index) => ({
        x: new Date(label.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")).getTime(),
        y: dados.temperaturas[index],
    }));

    if (historicoChartInstance) {
        historicoChartInstance.destroy();
    }

    historicoChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [{
                label: "Temperatura (°C)",
                data: initialData,
                borderColor: "#0d6efd",
                backgroundColor: "rgba(13, 110, 253, 0.1)",
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: "realtime",
                    realtime: {
                        duration: 900000,
                        refresh: 10000,
                        delay: 5000,
                    },
                    grid: { display: false },
                },
                y: {
                    title: { display: false },
                    grid: { color: "#e9ecef" },
                },
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
        },
    });
}
