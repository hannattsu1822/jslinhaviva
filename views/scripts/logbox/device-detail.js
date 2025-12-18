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
    console.error("Erro ao inicializar painel:", error);
    const loader = document.getElementById("loader-historico");
    if (loader) {
      loader.innerHTML = "Erro ao carregar dados. Tente recarregar a página.";
    }
  });
}

async function carregarLeiturasIniciais() {
  const loader = document.getElementById("loader-historico");
  const chartContainer = document.getElementById("graficoHistorico");

  try {
    if (loader) loader.style.display = "flex";

    const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
    if (!response.ok) throw new Error("Falha ao buscar histórico de leituras");

    const data = await response.json();
    gerarGraficoHistorico(data);

    if (loader) loader.style.display = "none";
    if (chartContainer) chartContainer.style.display = "block";
  } catch (error) {
    console.error("Erro ao carregar leituras:", error);
    if (loader) loader.innerHTML = "Erro ao carregar o gráfico.";
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
      const tempExterna = payloadObjeto.ch_analog_1 || (payloadObjeto.value_channels ? payloadObjeto.value_channels[2] : undefined);

      if (tempExterna !== undefined) {
        document.getElementById("latest-temp").textContent = tempExterna.toFixed(1);
      }

      document.getElementById("latest-timestamp").textContent = `Em: ${new Date(latestData.timestamp_leitura).toLocaleString("pt-BR")}`;
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

  // Status de conexão
  const connectionStatusEl = document.getElementById("connection-status-text");
  if (connectionStatusEl) {
    if (status.connection_status === "offline") {
      connectionStatusEl.textContent = "Offline";
      connectionStatusEl.className = "kpi-value text-danger";
    } else {
      connectionStatusEl.textContent = "Online";
      connectionStatusEl.className = "kpi-value text-success";
    }
  }

  // WiFi/RSSI
  const sinalWifi = status.lqi;
  const { text: wifiText } = getWifiStatus(sinalWifi);
  const wifiEl = document.getElementById("diag-wifi-rssi");
  if (wifiEl) {
    wifiEl.textContent = `RSSI: ${sinalWifi || "--"} dBm (${wifiText})`;
  }

  // Fonte de energia
  const tensaoFonteExterna = status.ch_analog_2;
  const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
  const powerEl = document.getElementById("diag-power-source");
  if (powerEl) {
    powerEl.textContent = powerText;
  }

  // Bateria
  const tensaoBateria = status.ch_analog_3 || status.battery;
  const batteryEl = document.getElementById("diag-battery-voltage");
  if (batteryEl) {
    batteryEl.textContent = `Bateria: ${tensaoBateria?.toFixed(2) || "--"} V`;
  }

  // Temperatura interna
  const temperaturaInterna = status.temperature;
  atualizarBadge("diag-internal-temp", `${temperaturaInterna?.toFixed(1) || "--"} °C`, "text-bg-info");
  atualizarBadge("diag-pt100-status", "N/A via MQTT", "text-bg-secondary");

  // IP e Firmware
  const ipAddress = status.ip;
  atualizarBadge("diag-ip-address", ipAddress || "--", "text-bg-secondary");

  const firmwareVersion = status.firmware_version;
  atualizarBadge("diag-firmware-version", firmwareVersion || "--", "text-bg-secondary");

  // Alarmes
  atualizarListaAlarmes(status.alarms);
}

function atualizarPainelLeitura(dados) {
  const temperatura = dados.ch_analog_1;
  if (temperatura !== undefined) {
    document.getElementById("latest-temp").textContent = temperatura.toFixed(1);
  }

  document.getElementById("latest-timestamp").textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;

  // Atualizar gráfico ECharts
  if (historicoChartInstance && temperatura !== undefined) {
    const now = new Date().getTime();
    
    // Obter dados atuais
    const option = historicoChartInstance.getOption();
    const currentData = option.series[0].data;
    
    // Adicionar novo ponto
    currentData.push([now, temperatura]);
    
    // Manter apenas últimos 200 pontos
    if (currentData.length > 200) {
      currentData.shift();
    }
    
    // Atualizar gráfico
    historicoChartInstance.setOption({
      series: [{
        data: currentData
      }]
    });
  }

  // Atualizar fonte de energia
  const tensaoFonteExterna = dados.ch_analog_2;
  const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
  document.getElementById("diag-power-source").textContent = powerText;

  // Atualizar bateria
  const tensaoBateria = dados.ch_analog_3 || dados.battery;
  document.getElementById("diag-battery-voltage").textContent = `Bateria: ${tensaoBateria?.toFixed(2) || "--"} V`;

  // Recarregar estatísticas
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
  const alarmSubtextEl = alarmCountEl?.nextElementSibling;

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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
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

      if (message.dados && message.dados.serial_number !== serialNumber) {
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
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
  }
}

// ✅ FUNÇÃO REESCRITA PARA ECHARTS
function gerarGraficoHistorico(dados) {
  const chartContainer = document.getElementById("graficoHistorico");
  if (!chartContainer) return;

  // Destruir instância anterior se existir
  if (historicoChartInstance) {
    historicoChartInstance.dispose();
    historicoChartInstance = null;
  }

  // Preparar dados no formato ECharts: [[timestamp, temperatura], ...]
  const chartData = dados.labels.map((label, index) => {
    // Converter label "dd/MM/yyyy, HH:mm:ss" para timestamp
    const timestamp = new Date(label.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")).getTime();
    return [timestamp, dados.temperaturas[index]];
  });

  // Inicializar ECharts
  historicoChartInstance = echarts.init(chartContainer);

  const option = {
    title: {
      show: false
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        const date = new Date(params[0].value[0]);
        const temp = params[0].value[1];
        return `${date.toLocaleString('pt-BR')}<br/>Temperatura: ${temp !== null ? temp.toFixed(1) : '--'} °C`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: {
        formatter: function (value) {
          const date = new Date(value);
          return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '°C',
      nameLocation: 'end',
      nameGap: 10,
      axisLabel: {
        formatter: '{value} °C'
      }
    },
    series: [
      {
        name: 'Temperatura',
        type: 'line',
        smooth: true,
        symbol: 'none',
        sampling: 'lttb',
        itemStyle: {
          color: '#0d6efd'
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(13, 110, 253, 0.3)' },
            { offset: 1, color: 'rgba(13, 110, 253, 0.05)' }
          ])
        },
        data: chartData
      }
    ]
  };

  historicoChartInstance.setOption(option);

  // Responsivo - ajustar ao redimensionar janela
  window.addEventListener('resize', function() {
    if (historicoChartInstance) {
      historicoChartInstance.resize();
    }
  });
}
