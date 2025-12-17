let historicoChartInstance = null;
let retryCount = 0;
const maxRetries = 10;

const CHART_CONFIG = {
  DURATION_MS: 15 * 60 * 1000,
  REFRESH_INTERVAL_MS: 10 * 1000,
  DELAY_MS: 5 * 1000
};

const TEMP_LIMITS = {
  MIN_VALID: -40,
  MAX_VALID: 85,
  MIN_REALISTIC: -10,
  MAX_REALISTIC: 60
};

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
      loader.innerHTML = "Erro ao carregar dados. Tente recarregar a página.";
    }
  });
}

function validarTemperaturaFrontend(temp) {
  if (temp === null || temp === undefined || isNaN(temp)) {
    return { valid: false, warning: false, reason: "Valor ausente" };
  }

  const tempNum = parseFloat(temp);

  if (tempNum < TEMP_LIMITS.MIN_VALID || tempNum > TEMP_LIMITS.MAX_VALID) {
    return { valid: false, warning: false, reason: "Temperatura inválida", value: tempNum };
  }

  if (tempNum < TEMP_LIMITS.MIN_REALISTIC || tempNum > TEMP_LIMITS.MAX_REALISTIC) {
    return { valid: true, warning: true, reason: "Temperatura fora do esperado", value: tempNum };
  }

  return { valid: true, warning: false, value: tempNum };
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
    if (loader) loader.innerHTML = "Erro ao carregar o gráfico.";
    throw error;
  }
}

async function carregarStatusInicial() {
  try {
    const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
    if (!response.ok) throw new Error("Falha ao buscar status do dispositivo");

    const data = await response.json();
    atualizarPainelCompleto(data);

    const latestReadingResponse = await fetch(`/api/logbox-device/${serialNumber}/latest`);
    if (latestReadingResponse.ok) {
      const latestData = await latestReadingResponse.json();

      if (latestData.temperatura_valida && latestData.temperatura_valor !== null) {
        const validacao = validarTemperaturaFrontend(latestData.temperatura_valor);
        atualizarTemperaturaDisplay(latestData.temperatura_valor, validacao);
      } else if (latestData.temperatura_aviso) {
        mostrarAvisoTemperatura(latestData.temperatura_aviso);
      }

      document.getElementById("latest-timestamp").textContent = `Em: ${new Date(latestData.timestamp_leitura).toLocaleString("pt-BR")}`;
    }
  } catch (error) {
    throw error;
  }
}

function atualizarTemperaturaDisplay(temperatura, validacao) {
  const tempElement = document.getElementById("latest-temp");
  const tempCard = tempElement.closest(".kpi-card");

  if (!validacao.valid) {
    tempElement.textContent = "--";
    tempElement.style.color = "#dc3545";
    if (tempCard) tempCard.style.borderLeft = "4px solid #dc3545";
  } else if (validacao.warning) {
    tempElement.textContent = temperatura.toFixed(1);
    tempElement.style.color = "#ffc107";
    if (tempCard) tempCard.style.borderLeft = "4px solid #ffc107";
  } else {
    tempElement.textContent = temperatura.toFixed(1);
    tempElement.style.color = "";
    if (tempCard) tempCard.style.borderLeft = "";
  }
}

function mostrarAvisoTemperatura(motivo) {
  const tempElement = document.getElementById("latest-temp");
  const timestampElement = document.getElementById("latest-timestamp");
  
  tempElement.textContent = "--";
  tempElement.style.color = "#dc3545";
  timestampElement.textContent = `Aviso: ${motivo}`;
  timestampElement.style.color = "#dc3545";
}

function atualizarPainelCompleto(status) {
  if (!status || Object.keys(status).length === 0) return;

  const connectionStatusEl = document.getElementById("connection-status-text");
  const isOnline = status.connection_status === "online";

  if (isOnline) {
    connectionStatusEl.textContent = "Online";
    connectionStatusEl.className = "kpi-value text-success";
    
    if (status.minutes_since_last_reading !== null) {
      const minutos = status.minutes_since_last_reading;
      document.getElementById("diag-wifi-rssi").innerHTML = `RSSI: ${status.lqi || "--"} dBm<br><small>Última leitura: há ${minutos} min</small>`;
    } else {
      const sinalWifi = status.lqi;
      const { text: wifiText } = getWifiStatus(sinalWifi);
      document.getElementById("diag-wifi-rssi").textContent = `RSSI: ${sinalWifi || "--"} dBm (${wifiText})`;
    }
  } else {
    connectionStatusEl.textContent = "Offline";
    connectionStatusEl.className = "kpi-value text-danger";
    
    if (status.connection_warning) {
      document.getElementById("diag-wifi-rssi").textContent = status.connection_warning;
    } else {
      document.getElementById("diag-wifi-rssi").textContent = "Sem comunicação";
    }

    ocultarInformacoesOffline();
  }

  const tensaoFonteExterna = status.ch_analog_2;
  const { text: powerText } = getPowerSourceStatus(tensaoFonteExterna);
  document.getElementById("diag-power-source").textContent = isOnline ? powerText : "Indisponível";

  const tensaoBateria = status.ch_analog_3 || status.battery;
  document.getElementById("diag-battery-voltage").textContent = isOnline && tensaoBateria 
    ? `Bateria: ${tensaoBateria.toFixed(2)} V` 
    : "Bateria: --";

  const temperaturaInterna = status.temperature;
  atualizarBadge("diag-internal-temp", isOnline && temperaturaInterna ? `${temperaturaInterna.toFixed(1)} °C` : "--", "text-bg-info");

  atualizarBadge("diag-pt100-status", "N/A via MQTT", "text-bg-secondary");

  const ipAddress = status.ip;
  atualizarBadge("diag-ip-address", isOnline && ipAddress ? ipAddress : "--", "text-bg-secondary");

  const firmwareVersion = status.firmware_version;
  atualizarBadge("diag-firmware-version", isOnline && firmwareVersion ? firmwareVersion : "--", "text-bg-secondary");

  atualizarListaAlarmes(isOnline ? status.alarms : null);
}

function ocultarInformacoesOffline() {
  const tempElement = document.getElementById("latest-temp");
  const timestampElement = document.getElementById("latest-timestamp");
  
  if (tempElement.textContent === "--" || tempElement.textContent === "") {
    tempElement.textContent = "--";
    tempElement.style.color = "#6c757d";
    timestampElement.textContent = "Aguardando conexão...";
    timestampElement.style.color = "#6c757d";
  }
}

function atualizarPainelLeitura(dados) {
  if (dados.temperatura_aviso) {
    mostrarAvisoTemperatura(dados.temperatura_aviso);
    return;
  }

  const temperatura = dados.ch_analog_1;
  const validacao = validarTemperaturaFrontend(temperatura);

  if (validacao.valid) {
    atualizarTemperaturaDisplay(temperatura, validacao);
    document.getElementById("latest-timestamp").textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;
    document.getElementById("latest-timestamp").style.color = "";

    if (historicoChartInstance && !validacao.warning) {
      historicoChartInstance.data.datasets[0].data.push({
        x: new Date(),
        y: temperatura,
      });
      historicoChartInstance.update("quiet");
    }
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
    alarmSubtextEl.textContent = "Aguardando dados...";
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

  socket.onopen = () => {
    console.log("[WebSocket] Conectado com sucesso");
    retryCount = 0;
  };

  socket.onclose = () => {
    console.log("[WebSocket] Conexão fechada, tentando reconectar...");
    
    if (retryCount < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`[WebSocket] Reconectando em ${delay}ms (tentativa ${retryCount + 1}/${maxRetries})`);
      
      setTimeout(iniciarWebSocket, delay);
      retryCount++;
    } else {
      console.error("[WebSocket] Número máximo de tentativas de reconexão atingido");
    }
  };

  socket.onerror = (error) => {
    console.error("[WebSocket] Erro na conexão:", error);
  };

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
    } catch (e) {
      console.error("[WebSocket] Erro ao processar mensagem:", e);
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
    console.error("[Stats] Erro ao carregar estatísticas:", error);
  }
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
            duration: CHART_CONFIG.DURATION_MS,
            refresh: CHART_CONFIG.REFRESH_INTERVAL_MS,
            delay: CHART_CONFIG.DELAY_MS,
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
        },
      },
    },
  });
}
