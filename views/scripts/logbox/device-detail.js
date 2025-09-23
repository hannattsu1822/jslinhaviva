let historicoChartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  inicializarPainel();
});

function inicializarPainel() {
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  Promise.all([
    carregarLeiturasIniciais(),
    carregarStatusInicial(),
    carregarEstatisticasDetalhes(),
    carregarDadosVentilacao(),
    carregarHistoricoConexao(),
  ])
    .then(() => {
      console.log("Painel inicializado com sucesso.");
      iniciarWebSocket();
    })
    .catch((error) => {
      console.error("Falha ao inicializar o painel:", error);
      document.getElementById("loader-historico").innerHTML =
        "Erro ao carregar dados. Tente recarregar a página.";
    });
}

async function carregarLeiturasIniciais() {
  const loader = document.getElementById("loader-historico");
  const canvas = document.getElementById("graficoHistorico");
  try {
    loader.style.display = "flex";
    const response = await fetch(`/api/logbox-device/${serialNumber}/leituras`);
    if (!response.ok) throw new Error("Falha ao buscar histórico de leituras");

    const data = await response.json();
    gerarGraficoHistorico(data);
    loader.style.display = "none";
    canvas.style.display = "block";
  } catch (error) {
    console.error(error);
    loader.innerHTML = "Erro ao carregar o gráfico.";
    throw error;
  }
}

async function carregarStatusInicial() {
  try {
    const response = await fetch(`/api/logbox-device/${serialNumber}/status`);
    if (!response.ok) throw new Error("Falha ao buscar status do dispositivo");

    const data = await response.json();
    atualizarPainelCompleto(data.status);

    const latestReadingResponse = await fetch(
      `/api/logbox-device/${serialNumber}/latest`
    );
    if (latestReadingResponse.ok) {
      const latestData = await latestReadingResponse.json();
      const payloadObjeto = JSON.parse(latestData.payload);
      const tempExterna =
        payloadObjeto.ch_analog_1 || (payloadObjeto.value_channels ? payloadObjeto.value_channels[2] : undefined);
      if (tempExterna !== undefined) {
        document.getElementById("latest-temp").textContent =
          tempExterna.toFixed(1);
      }
      document.getElementById("latest-timestamp").textContent = `Em: ${new Date(
        latestData.timestamp_leitura
      ).toLocaleString("pt-BR")}`;
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function atualizarPainelCompleto(status) {
  if (!status || Object.keys(status).length === 0) {
    return;
  }

  const connectionBadge = document.getElementById("connection-status-badge");
  if (status.connection_status === "offline") {
    connectionBadge.textContent = "Offline";
    connectionBadge.className = "badge ms-3 fs-6 bg-danger";
  } else {
    connectionBadge.textContent = "Online";
    connectionBadge.className = "badge ms-3 fs-6 bg-success";
  }

  const temperaturaExterna = status.ch_analog_1 || (status.value_channels ? status.value_channels[2] : undefined);
  const tensaoFonteExterna = status.ch_analog_2;
  const tensaoBateria = status.ch_analog_3 || status.battery;
  const sinalWifi = status.lqi;
  const alarmes = status.alarms;
  const temperaturaInterna = status.temperature;
  const ipAddress = status.ip;
  const firmwareVersion = status.firmware_version;

  const { text: wifiText, className: wifiClass } = getWifiStatus(sinalWifi);
  atualizarBadge("diag-wifi-rssi", `${sinalWifi || "--"} dBm`, wifiClass);

  const { text: powerText, className: powerClass } =
    getPowerSourceStatus(tensaoFonteExterna);
  atualizarBadge("diag-power-source", powerText, powerClass);

  atualizarBadge(
    "diag-internal-temp",
    `${temperaturaInterna?.toFixed(1) || "--"} °C`,
    "bg-status-info"
  );
  atualizarBadge(
    "diag-battery-voltage",
    `${tensaoBateria?.toFixed(2) || "--"} V`,
    tensaoBateria < 4.8 ? "bg-status-warning" : "bg-status-ok"
  );

  atualizarBadge("diag-pt100-status", "N/A via MQTT", "bg-secondary");

  const { text: mqttText, className: mqttClass } = getMqttStatus(true);
  atualizarBadge("diag-mqtt-status", mqttText, mqttClass);

  atualizarBadge("diag-ip-address", ipAddress || "--", "bg-info text-dark");
  atualizarBadge("diag-firmware-version", firmwareVersion || "--", "bg-info text-dark");

  atualizarListaAlarmes(alarmes);
  atualizarStatusGeral();
}

function atualizarBadge(elementId, text, className) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
    element.className = `badge ${className}`;
  }
}

function atualizarListaAlarmes(alarms) {
  const alarmList = document.getElementById("active-alarms-list");
  alarmList.innerHTML = "";

  if (!alarms) {
    alarmList.innerHTML =
      '<div class="list-group-item text-muted text-center placeholder">Nenhum alarme ativo.</div>';
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

  if (activeAlarms.length === 0) {
    alarmList.innerHTML =
      '<div class="list-group-item text-muted text-center placeholder">Nenhum alarme ativo.</div>';
    return;
  }

  activeAlarms.forEach(([key, value]) => {
    const alarmItem = document.createElement("div");
    alarmItem.className = "list-group-item alarm-item text-status-critical";

    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = "warning";

    const text = document.createElement("span");
    text.textContent = formatarNomeAlarme(key);

    alarmItem.appendChild(icon);
    alarmItem.appendChild(text);
    alarmList.appendChild(alarmItem);
  });
}

function formatarNomeAlarme(key) {
  const nomes = {
    "A1.H": "Temperatura Alta (CH 1)",
    "A1.L": "Temperatura Baixa (CH 1)",
    "A2.H": "Alarme Alto (CH 2)",
    "A2.L": "Alarme Baixo (CH 2)",
    "A3.H": "Alarme Alto (CH 3)",
    "A3.L": "Alarme Baixo (CH 3)",
    "D1.H": "Alarme Digital Ativo",
  };
  return nomes[key] || key.replace(".", " ").toUpperCase();
}

function iniciarWebSocket() {
  const socket = new WebSocket(`ws://${window.location.host}`);

  socket.onopen = () => console.log("Conexão WebSocket estabelecida.");
  socket.onclose = () => {
    console.log("Conexão WebSocket fechada. Tentando reconectar em 5s...");
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
            console.log("Recebida nova leitura do LogBox:", message.dados);
            const temperatura = message.dados.ch_analog_1 || (message.dados.value_channels ? message.dados.value_channels[2] : undefined);
            if (temperatura !== undefined) {
                document.getElementById("latest-temp").textContent = temperatura.toFixed(1);
                if (historicoChartInstance) {
                    historicoChartInstance.data.datasets[0].data.push({
                      x: new Date(),
                      y: temperatura,
                    });
                    historicoChartInstance.update("quiet");
                }
            }
            document.getElementById("latest-timestamp").textContent = `Em: ${new Date().toLocaleString("pt-BR")}`;
            carregarEstatisticasDetalhes();
            carregarDadosVentilacao();
        }

        if (message.type === "atualizacao_status") {
            console.log("Atualização de status recebida:", message.dados);
            atualizarPainelCompleto(message.dados);
            if (message.dados.connection_status === 'online') {
                carregarHistoricoConexao();
            }
        }
    } catch (e) {
        console.error("Erro ao processar mensagem do WebSocket:", e);
    }
  };
}

function getWifiStatus(rssi) {
  if (!rssi) return { text: "Sem Sinal", className: "bg-status-critical" };
  if (rssi >= -67) return { text: "Excelente", className: "bg-status-ok" };
  if (rssi >= -75) return { text: "Bom", className: "bg-status-info" };
  if (rssi >= -85) return { text: "Fraco", className: "bg-status-warning" };
  return { text: "Muito Fraco", className: "bg-status-critical" };
}

function getSensorStatus(status) {
  if (status === "OK") return { text: "OK", className: "bg-status-ok" };
  if (status === "OpenCircuit")
    return { text: "Circuito Aberto", className: "bg-status-critical" };
  if (status === "ShortCircuit")
    return { text: "Curto-Circuito", className: "bg-status-critical" };
  return { text: "Desconhecido", className: "bg-secondary" };
}

function getMqttStatus(connected) {
  if (connected === true)
    return { text: "Conectado", className: "bg-status-ok" };
  if (connected === false)
    return { text: "Desconectado", className: "bg-status-critical" };
  return { text: "Verificando...", className: "bg-secondary" };
}

function getPowerSourceStatus(voltage) {
  if (voltage === undefined || voltage === null)
    return { text: "Verificando...", className: "bg-secondary" };
  if (voltage > 9)
    return {
      text: `Rede Elétrica (${voltage.toFixed(1)}V)`,
      className: "bg-status-ok",
    };
  return { text: "Apenas Bateria", className: "bg-status-warning" };
}

// ==================================================================
// FUNÇÃO CORRIGIDA
// ==================================================================
function atualizarStatusGeral() {
  const indicator = document.getElementById("geral-status-indicator");
  const pt100Badge = document.getElementById("diag-pt100-status"); // Pode ser null
  const alarmsList = document.getElementById("active-alarms-list");
  const connectionBadge = document.getElementById("connection-status-badge");

  // Garante que os elementos essenciais existem antes de prosseguir
  if (!indicator || !alarmsList || !connectionBadge) {
    console.error("Elementos essenciais do painel de status não foram encontrados no DOM.");
    return;
  }

  // Verifica se há uma condição crítica. Adiciona a verificação "pt100Badge &&"
  const isCritical =
    connectionBadge.classList.contains("bg-danger") ||
    (pt100Badge && pt100Badge.classList.contains("bg-status-critical")) ||
    alarmsList.querySelector(".alarm-item");

  const diagWifi = document.getElementById("diag-wifi-rssi");
  const diagBattery = document.getElementById("diag-battery-voltage");

  // Verifica se há uma condição de aviso
  const isWarning =
    (diagWifi && (diagWifi.classList.contains("bg-status-warning") || diagWifi.classList.contains("bg-status-critical"))) ||
    (diagBattery && diagBattery.classList.contains("bg-status-warning"));

  if (isCritical) {
    indicator.className = "status-indicator critical";
    indicator.setAttribute(
      "title",
      "Status Crítico: Dispositivo offline, falha no sensor ou alarme ativo!"
    );
  } else if (isWarning) {
    indicator.className = "status-indicator warning";
    indicator.setAttribute("title", "Aviso: Conexão fraca ou bateria baixa.");
  } else {
    indicator.className = "status-indicator ok";
    indicator.setAttribute("title", "Sistema operando normalmente.");
  }

  // Atualiza o tooltip
  const tooltip = bootstrap.Tooltip.getInstance(indicator);
  if (tooltip) {
    tooltip.setContent({ ".tooltip-inner": indicator.getAttribute("title") });
  }
}

async function carregarEstatisticasDetalhes() {
  try {
    const response = await fetch(
      `/api/logbox-device/${serialNumber}/stats-detail`
    );
    const stats = await response.json();
    document.getElementById("stat-today-min").textContent = stats.today.min;
    document.getElementById("stat-today-avg").textContent = stats.today.avg;
    document.getElementById("stat-today-max").textContent = stats.today.max;
    document.getElementById("stat-month-min").textContent = stats.month.min;
    document.getElementById("stat-month-avg").textContent = stats.month.avg;
    document.getElementById("stat-month-max").textContent = stats.month.max;
  } catch (error) {
    console.error("Erro ao carregar estatísticas detalhadas:", error);
  }
}

async function carregarDadosVentilacao() {
  try {
    const historyResponse = await fetch(
      `/api/logbox-device/${serialNumber}/ventilation-history`
    );
    const history = await historyResponse.json();
    const tableBody = document.querySelector("#fan-history-table tbody");
    tableBody.innerHTML = "";
    if (history.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="3" class="text-center text-muted">Nenhum acionamento registrado.</td></tr>';
    } else {
      history.forEach((item) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = new Date(
          item.timestamp_inicio
        ).toLocaleString("pt-BR");
        row.insertCell(1).textContent = item.timestamp_fim
          ? new Date(item.timestamp_fim).toLocaleString("pt-BR")
          : "Ativa";
        row.insertCell(2).textContent = formatarDuracao(item.duracao_segundos);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar dados da ventilação:", error);
  }
}

async function carregarHistoricoConexao() {
  try {
    const response = await fetch(`/api/logbox-device/${serialNumber}/connection-history`);
    if (!response.ok) throw new Error("Falha ao buscar histórico de conexão");

    const data = await response.json();

    document.getElementById("conn-total-disconnects").textContent = data.summary.total_disconnects;
    document.getElementById("conn-avg-duration").textContent = formatarDuracao(data.summary.avg_duration_seconds);

    const tableBody = document.getElementById("connection-history-table-body");
    tableBody.innerHTML = "";

    if (data.history.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum evento de desconexão registrado.</td></tr>';
    } else {
      data.history.forEach((item) => {
        const row = tableBody.insertRow();
        row.insertCell(0).textContent = new Date(item.timestamp_offline).toLocaleString("pt-BR");
        row.insertCell(1).textContent = item.timestamp_online ? new Date(item.timestamp_online).toLocaleString("pt-BR") : "Ainda Offline";
        row.insertCell(2).textContent = formatarDuracao(item.duracao_segundos);
        row.insertCell(3).textContent = item.ultimo_rssi ? `${item.ultimo_rssi} dBm` : "N/A";
      });
    }
  } catch (error) {
    console.error("Erro ao carregar histórico de conexão:", error);
  }
}

function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return "Em andamento";
  if (segundos < 60) return `${segundos} seg`;
  if (segundos < 3600)
    return `${Math.floor(segundos / 60)} min ${segundos % 60} seg`;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return `${horas}h ${minutos}min`;
}

function gerarGraficoHistorico(dados) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");
  const initialData = dados.labels.map((label, index) => ({
    x: new Date(
      label.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")
    ).getTime(),
    y: dados.temperaturas[index],
  }));

  if (historicoChartInstance) {
    historicoChartInstance.destroy();
  }

  historicoChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Temperatura (°C)",
          data: initialData,
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13, 110, 253, 0.1)",
          fill: true,
          tension: 0.2,
        },
      ],
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
        },
        y: {
          title: {
            display: true,
            text: "Temperatura (°C)",
          },
        },
      },
    },
  });
}
