let historicoChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    inicializarPainel();
});

function inicializarPainel() {
    Promise.all([
        carregarLeiturasIniciais(),
        carregarStatusInicial(),
        carregarEstatisticasDetalhes(),
    ])
        .then(() => {
            iniciarWebSocket();
        })
        .catch((error) => {
            console.error("Erro ao inicializar painel:", error);
            const loader = document.getElementById("loader-historico");
            if (loader) {
                loader.innerHTML = `
                    <div class="chart-loader">
                        <div class="spinner"></div>
                        <p>Erro ao carregar dados. Tente recarregar a página.</p>
                    </div>
                `;
            }
        });
}

async function carregarLeiturasIniciais() {
    const loader = document.getElementById("loader-historico");
    const chartContainer = document.getElementById("graficoHistorico");

    try {
        if (loader) loader.style.display = "block";

        const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
        if (!response.ok) throw new Error("Falha ao buscar histórico de leituras");

        const data = await response.json();
        gerarGraficoHistorico(data);

        if (loader) loader.style.display = "none";
        if (chartContainer) chartContainer.style.display = "block";
    } catch (error) {
        console.error("Erro ao carregar leituras:", error);
        if (loader) {
            loader.innerHTML = `
                <div class="chart-loader">
                    <div class="spinner"></div>
                    <p>Erro ao carregar o gráfico.</p>
                </div>
            `;
        }
    }
}

async function carregarStatusInicial() {
    try {
        const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
        if (!response.ok) throw new Error("Falha ao buscar status do dispositivo");

        const data = await response.json();
        console.log("Status recebido:", data);
        atualizarPainelCompleto(data);

        const latestReadingResponse = await fetch(`/api/logbox-device/${serialNumber}/latest`);
        if (latestReadingResponse.ok) {
            const latestData = await latestReadingResponse.json();
            const payloadObjeto = JSON.parse(latestData.payload);

            const tempExterna =
                payloadObjeto.ch_analog_1 ||
                (payloadObjeto.value_channels ? payloadObjeto.value_channels[2] : undefined);

            if (tempExterna !== undefined) {
                const latestTempEl = document.getElementById("latest-temp");
                if (latestTempEl) {
                    latestTempEl.textContent = tempExterna.toFixed(1);
                }
            }

            const latestTimestampEl = document.getElementById("latest-timestamp");
            if (latestTimestampEl) {
                latestTimestampEl.textContent = `Em: ${new Date(
                    latestData.timestamp_leitura
                ).toLocaleString("pt-BR")}`;
            }
        }
    } catch (error) {
        console.error("Erro ao carregar status:", error);
    }
}

function atualizarPainelCompleto(status) {
    console.log("Atualizando painel com status:", status);

    if (!status || Object.keys(status).length === 0) {
        console.warn("Status vazio ou inválido");
        return;
    }

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
    const { text: wifiText } = getWifiStatus(sinalWifi);
    const wifiEl = document.getElementById("diag-wifi-rssi");
    if (wifiEl) {
        wifiEl.textContent = `RSSI: ${sinalWifi || "--"} dBm (${wifiText})`;
    }

    const tensaoFonteExterna = status.ch_analog_2;
    const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
    const powerEl = document.getElementById("diag-power-source");
    if (powerEl) {
        powerEl.textContent = powerText;
    }

    const tensaoBateria = status.ch_analog_3 || status.battery;
    const batteryEl = document.getElementById("diag-battery-voltage");
    if (batteryEl) {
        batteryEl.textContent = `Bateria: ${tensaoBateria?.toFixed(2) || "--"} V`;
    }

    const temperaturaInterna = status.temperature;
    atualizarTag("diag-internal-temp", `${temperaturaInterna?.toFixed(1) || "--"} °C`);

    atualizarTag("diag-pt100-status", "N/A via MQTT");

    const ipAddress = status.ip;
    atualizarTag("diag-ip-address", ipAddress || "--");

    const firmwareVersion = status.firmware_version;
    atualizarTag("diag-firmware-version", firmwareVersion || "--");

    atualizarListaAlarmes(status.alarms);
}

function atualizarPainelLeitura(dados) {
    console.log("Atualizando painel com nova leitura:", dados);

    let temperatura = dados.ch_analog_1;

    if (temperatura === undefined && dados.value_channels) {
        temperatura = dados.value_channels[2];
    }

    if (temperatura !== undefined && temperatura !== null) {
        const tempElement = document.getElementById("latest-temp");
        if (tempElement) {
            tempElement.textContent = temperatura.toFixed(1);
            const parent = tempElement.parentElement;
            if (parent) {
                parent.classList.add("has-background-info-light");
                setTimeout(() => {
                    parent.classList.remove("has-background-info-light");
                }, 1000);
            }
        }
    }

    const timestampElement = document.getElementById("latest-timestamp");
    if (timestampElement) {
        timestampElement.textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;
    }

    if (historicoChartInstance && temperatura !== undefined && temperatura !== null) {
        const now = new Date().getTime();
        const option = historicoChartInstance.getOption();

        if (option && option.series && option.series[0] && option.series[0].data) {
            const currentData = option.series[0].data;
            currentData.push([now, temperatura]);

            if (currentData.length > 200) {
                currentData.shift();
            }

            historicoChartInstance.setOption({
                series: [
                    {
                        data: currentData,
                    },
                ],
            });
        }
    }

    const tensaoFonteExterna = dados.ch_analog_2;
    if (tensaoFonteExterna !== undefined) {
        const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
        const powerEl = document.getElementById("diag-power-source");
        if (powerEl) {
            powerEl.textContent = powerText;
        }
    }

    const tensaoBateria = dados.ch_analog_3 || dados.battery;
    if (tensaoBateria !== undefined) {
        const batteryEl = document.getElementById("diag-battery-voltage");
        if (batteryEl) {
            batteryEl.textContent = `Bateria: ${tensaoBateria.toFixed(2)} V`;
        }
    }

    carregarEstatisticasDetalhes();
}

function atualizarTag(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function atualizarListaAlarmes(alarms) {
    const alarmCountEl = document.getElementById("active-alarms-count");
    const alarmSubtextEl = document.getElementById("alarm-subtitle");

    if (!alarmCountEl) return;

    if (!alarms) {
        alarmCountEl.textContent = "0";
        if (alarmSubtextEl) alarmSubtextEl.textContent = "Nenhum alarme no momento";
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

    if (alarmSubtextEl) {
        if (activeAlarms.length > 0) {
            alarmSubtextEl.textContent = `${activeAlarms.length} alarme(s) ativo(s)`;
        } else {
            alarmSubtextEl.textContent = "Nenhum alarme no momento";
        }
    }
}

function iniciarWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onopen = () => {
        console.log("WebSocket conectado");
    };

    socket.onclose = () => {
        console.log("WebSocket desconectado, reconectando em 5s...");
        setTimeout(iniciarWebSocket, 5000);
    };

    socket.onerror = (error) => {
        console.error("Erro no WebSocket:", error);
    };

    socket.onmessage = function (event) {
        try {
            const message = JSON.parse(event.data);

            if (message.dados && message.dados.serial_number && message.dados.serial_number !== serialNumber) {
                return;
            }

            if (message.type === "nova_leitura_logbox") {
                console.log("Nova leitura recebida via WebSocket:", message.dados);
                atualizarPainelLeitura(message.dados);
            }

            if (message.type === "atualizacao_status") {
                console.log("Atualização de status recebida via WebSocket:", message.dados);
                atualizarPainelCompleto(message.dados);
            }
        } catch (e) {
            console.error("Erro ao processar mensagem WebSocket:", e);
        }
    };
}

function getWifiStatus(rssi) {
    if (!rssi && rssi !== 0) return { text: "Sem Sinal" };
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

        const statTodayMin = document.getElementById("stat-today-min");
        const statTodayAvg = document.getElementById("stat-today-avg");
        const statTodayMax = document.getElementById("stat-today-max");
        const statMonthMin = document.getElementById("stat-month-min");
        const statMonthAvg = document.getElementById("stat-month-avg");
        const statMonthMax = document.getElementById("stat-month-max");

        if (statTodayMin) statTodayMin.textContent = `${stats.today.min} °C`;
        if (statTodayAvg) statTodayAvg.textContent = `${stats.today.avg} °C`;
        if (statTodayMax) statTodayMax.textContent = `${stats.today.max} °C`;
        if (statMonthMin) statMonthMin.textContent = `${stats.month.min} °C`;
        if (statMonthAvg) statMonthAvg.textContent = `${stats.month.avg} °C`;
        if (statMonthMax) statMonthMax.textContent = `${stats.month.max} °C`;
    } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
    }
}

function gerarGraficoHistorico(dados) {
    const chartContainer = document.getElementById("graficoHistorico");
    if (!chartContainer) {
        console.error("Elemento graficoHistorico não encontrado");
        return;
    }

    if (historicoChartInstance) {
        historicoChartInstance.dispose();
        historicoChartInstance = null;
    }

    const chartData = dados.labels.map((label, index) => {
        const timestamp = new Date(
            label.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")
        ).getTime();
        return [timestamp, dados.temperaturas[index]];
    });

    historicoChartInstance = echarts.init(chartContainer);

    const option = {
        title: {
            show: false,
        },
        tooltip: {
            trigger: "axis",
            formatter: function (params) {
                if (!params || params.length === 0) return "";
                const date = new Date(params[0].value[0]);
                const temp = params[0].value[1];
                return `${date.toLocaleString("pt-BR")}<br/>Temperatura: ${temp.toFixed(1)} °C`;
            },
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            containLabel: true,
        },
        xAxis: {
            type: "time",
            boundaryGap: false,
            axisLabel: {
                formatter: function (value) {
                    const date = new Date(value);
                    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" }
                    )}`;
                },
            },
        },
        yAxis: {
            type: "value",
            name: "Temperatura (°C)",
            axisLabel: {
                formatter: "{value} °C",
            },
        },
        series: [
            {
                name: "Temperatura",
                type: "line",
                smooth: true,
                data: chartData,
                lineStyle: {
                    color: "#3273dc",
                    width: 2,
                },
                itemStyle: {
                    color: "#3273dc",
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: "rgba(50, 115, 220, 0.3)",
                        },
                        {
                            offset: 1,
                            color: "rgba(50, 115, 220, 0.05)",
                        },
                    ]),
                },
            },
        ],
    };

    historicoChartInstance.setOption(option);

    window.addEventListener("resize", () => {
        if (historicoChartInstance) {
            historicoChartInstance.resize();
        }
    });
}
