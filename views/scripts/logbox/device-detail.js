let historicoChartInstance = null;

// Log para confirmar que o script carregou
console.log("Script device-detail.js carregado com sucesso.");

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM carregado, iniciando painel...");
    inicializarPainel();
});

function inicializarPainel() {
    // Iniciar WebSocket imediatamente, sem esperar API
    iniciarWebSocket();

    // Carregar dados iniciais em paralelo, mas tratando erros individualmente
    carregarLeiturasIniciais();
    carregarStatusInicial();
    carregarEstatisticasDetalhes();
}

async function carregarLeiturasIniciais() {
    console.log("Iniciando carregamento de leituras...");
    const loader = document.getElementById("loader-historico");
    const chartContainer = document.getElementById("graficoHistorico");

    try {
        if (loader) loader.style.display = "block";
        if (chartContainer) chartContainer.style.display = "none";

        const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        console.log("Leituras recebidas:", data);
        
        gerarGraficoHistorico(data);

        if (loader) loader.style.display = "none";
        if (chartContainer) chartContainer.style.display = "block";
    } catch (error) {
        console.error("Erro ao carregar leituras:", error);
        if (loader) {
            loader.innerHTML = `
                <div class="has-text-centered py-6">
                    <p class="has-text-danger">Erro ao carregar o gráfico. Verifique o console.</p>
                </div>
            `;
        }
    }
}

async function carregarStatusInicial() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
        if (!response.ok) throw new Error("Falha ao buscar status");

        const data = await response.json();
        // Correção para pegar data.status se vier aninhado, ou data direto
        const statusData = data.status || data;
        
        console.log("Status inicial:", statusData);
        atualizarPainelCompleto(statusData);

        // Buscar última leitura para preencher temperatura imediatamente
        const latestResp = await fetch(`/api/logbox-device/${serialNumber}/latest`);
        if (latestResp.ok) {
            const latest = await latestResp.json();
            if (latest && latest.payload) {
                 const payload = JSON.parse(latest.payload);
                 // Tenta pegar temperatura de várias formas
                 const temp = payload.ch_analog_1 !== undefined ? payload.ch_analog_1 :
                              (payload.value_channels ? payload.value_channels[2] : null);
                 
                 if (temp !== null) {
                     const el = document.getElementById("latest-temp");
                     if (el) el.textContent = temp.toFixed(1);
                 }
                 const timeEl = document.getElementById("latest-timestamp");
                 if (timeEl) timeEl.textContent = `Em: ${new Date(latest.timestamp_leitura).toLocaleString("pt-BR")}`;
            }
        }

    } catch (error) {
        console.error("Erro ao carregar status:", error);
    }
}

function atualizarPainelCompleto(status) {
    if (!status) return;

    const connectionStatusEl = document.getElementById("connection-status-text");
    if (connectionStatusEl) {
        if (status.connection_status === "offline") {
            connectionStatusEl.textContent = "Offline";
            connectionStatusEl.classList.remove("has-text-success");
            connectionStatusEl.classList.add("has-text-danger");
        } else {
            connectionStatusEl.textContent = "Online";
            connectionStatusEl.classList.remove("has-text-danger");
            connectionStatusEl.classList.add("has-text-success");
        }
    }

    const sinalWifi = status.lqi;
    const wifiEl = document.getElementById("diag-wifi-rssi");
    if (wifiEl) wifiEl.textContent = `RSSI: ${sinalWifi || "--"} dBm (${getWifiStatus(sinalWifi).text})`;

    const powerEl = document.getElementById("diag-power-source");
    if (powerEl) powerEl.textContent = getPowerSourceStatus(status.ch_analog_2).text;

    const batteryEl = document.getElementById("diag-battery-voltage");
    if (batteryEl) batteryEl.textContent = `Bateria: ${status.ch_analog_3?.toFixed(2) || status.battery?.toFixed(2) || "--"} V`;

    atualizarTag("diag-internal-temp", `${status.temperature?.toFixed(1) || "--"} °C`);
    atualizarTag("diag-ip-address", status.ip || "--");
    atualizarTag("diag-firmware-version", status.firmware_version || "--");
    
    atualizarListaAlarmes(status.alarms);
}

function atualizarPainelLeitura(dados) {
    console.log("Atualizando painel (WebSocket):", dados);

    let temperatura = dados.ch_analog_1;
    if (temperatura === undefined && dados.value_channels) {
        temperatura = dados.value_channels[2];
    }

    if (temperatura !== undefined && temperatura !== null) {
        const tempElement = document.getElementById("latest-temp");
        if (tempElement) {
            tempElement.textContent = temperatura.toFixed(1);
            // Animação visual
            const box = tempElement.closest(".box");
            if(box) {
                box.style.transition = "background-color 0.5s";
                box.style.backgroundColor = "#e3f2fd"; // Azul claro
                setTimeout(() => box.style.backgroundColor = "", 500);
            }
        }
        
        // Atualizar Gráfico
        if (historicoChartInstance) {
            const now = new Date().getTime();
            const option = historicoChartInstance.getOption();
            if (option && option.series && option.series[0]) {
                const data = option.series[0].data;
                data.push([now, temperatura]);
                if (data.length > 200) data.shift(); // Manter janela móvel
                historicoChartInstance.setOption({ series: [{ data: data }] });
            }
        }
    }

    const timestampElement = document.getElementById("latest-timestamp");
    if (timestampElement) timestampElement.textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;
    
    // Atualiza outros indicadores se vierem no pacote
    if (dados.ch_analog_2 !== undefined) {
         const powerEl = document.getElementById("diag-power-source");
         if(powerEl) powerEl.textContent = getPowerSourceStatus(dados.ch_analog_2).text;
    }
}

function atualizarTag(id, text) {
    const el = document.getElementById(id);
    if(el) el.textContent = text;
}

function atualizarListaAlarmes(alarms) {
    const countEl = document.getElementById("active-alarms-count");
    const subEl = document.getElementById("alarm-subtitle");
    if(!countEl) return;

    if (!alarms) {
        countEl.textContent = "0";
        if(subEl) subEl.textContent = "Nenhum alarme";
        return;
    }

    let activeCount = 0;
    if (Array.isArray(alarms)) {
        activeCount = alarms.filter(a => a === 1).length;
    } else {
        activeCount = Object.values(alarms).filter(v => v === true).length;
    }
    
    countEl.textContent = activeCount;
    if(subEl) subEl.textContent = activeCount > 0 ? `${activeCount} alarme(s) ativo(s)` : "Nenhum alarme";
}

function iniciarWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;
    
    console.log(`Conectando WebSocket em: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => console.log("✅ WebSocket conectado com sucesso!");
    
    socket.onclose = () => {
        console.warn("WebSocket desconectado. Tentando reconectar em 5s...");
        setTimeout(iniciarWebSocket, 5000);
    };

    socket.onerror = (err) => console.error("❌ Erro no WebSocket:", err);

    socket.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            // Ignora se for de outro dispositivo (caso o backend mande broadcast global)
            if (msg.dados && msg.dados.serial_number && msg.dados.serial_number !== serialNumber) return;

            if (msg.type === "nova_leitura_logbox" || msg.type === "nova_leitura") {
                atualizarPainelLeitura(msg.dados);
            } else if (msg.type === "atualizacao_status") {
                atualizarPainelCompleto(msg.dados);
            }
        } catch (e) {
            console.error("Erro ao processar msg WebSocket:", e);
        }
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
    return voltage > 9 ? { text: "Rede Elétrica" } : { text: "Apenas Bateria" };
}

async function carregarEstatisticasDetalhes() {
    try {
        const res = await fetch(`/api/logbox-device/${serialNumber}/stats-detail`);
        if(res.ok) {
            const stats = await res.json();
            const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = `${val} °C`; };
            set("stat-today-min", stats.today.min);
            set("stat-today-avg", stats.today.avg);
            set("stat-today-max", stats.today.max);
            set("stat-month-min", stats.month.min);
            set("stat-month-avg", stats.month.avg);
            set("stat-month-max", stats.month.max);
        }
    } catch(e) { console.error("Erro stats:", e); }
}

function gerarGraficoHistorico(dados) {
    const container = document.getElementById("graficoHistorico");
    if (!container) return;
    
    // Se não houver dados, exibe msg e não inicia chart
    if (!dados.labels || dados.labels.length === 0) {
        container.innerHTML = '<p class="has-text-centered py-6">Sem dados históricos disponíveis.</p>';
        return;
    }

    if (historicoChartInstance) {
        historicoChartInstance.dispose();
        historicoChartInstance = null;
    }

    const chartData = dados.labels.map((label, index) => {
        // Converte DD/MM/YYYY HH:mm:ss para timestamp
        const parts = label.split(/[\/\s:]/); // divide por /, espaço ou :
        // parts: [0]Dia, [1]Mes, [2]Ano, [3]Hora, [4]Min, [5]Seg
        // Date(ano, mes-1, dia, hora, min, seg)
        const date = new Date(parts[2], parts[1]-1, parts[0], parts[3], parts[4], parts[5]);
        return [date.getTime(), dados.temperaturas[index]];
    });

    historicoChartInstance = echarts.init(container);

    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: params => {
                if(!params[0]) return '';
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
                    return `${date.getHours()}:${date.getMinutes().toString().padStart(2,'0')}`;
                }
            }
        },
        yAxis: { type: 'value', axisLabel: { formatter: '{value} °C' }, scale: true },
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
