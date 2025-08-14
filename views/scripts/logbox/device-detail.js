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
      document.getElementById("latest-temp").textContent =
        payloadObjeto.value_channels[2].toFixed(1);
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
    console.warn("Nenhum dado de status recebido para atualizar o painel.");
    return;
  }

  const { text: wifiText, className: wifiClass } = getWifiStatus(status.rssi);
  atualizarBadge("diag-wifi-rssi", `${status.rssi || "--"} dBm`, wifiClass);

  const { text: pt100Text, className: pt100Class } = getSensorStatus(
    status.A1?.status
  );
  atualizarBadge("diag-pt100-status", pt100Text, pt100Class);

  const { text: mqttText, className: mqttClass } = getMqttStatus(
    status.connected
  );
  atualizarBadge("diag-mqtt-status", mqttText, mqttClass);

  const { text: powerText, className: powerClass } = getPowerSourceStatus(
    status.pwr_voltage
  );
  atualizarBadge("diag-power-source", powerText, powerClass);

  atualizarBadge(
    "diag-internal-temp",
    `${status.temperature?.toFixed(1) || "--"} °C`,
    "bg-status-info"
  );
  atualizarBadge(
    "diag-battery-voltage",
    `${status.battery?.toFixed(2) || "--"} V`,
    status.battery < 4.8 ? "bg-status-warning" : "bg-status-ok"
  );

  atualizarListaAlarmes(status.alarms);

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

  const activeAlarms = alarms
    ? Object.entries(alarms).filter(([key, value]) => value === true)
    : [];

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

  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);

    if (
      message.type === "nova_leitura" &&
      message.dados.serial_number === serialNumber
    ) {
      document.getElementById("latest-temp").textContent =
        message.dados.temperatura.toFixed(1);
      document.getElementById(
        "latest-timestamp"
      ).textContent = `Em: ${message.dados.timestamp_leitura}`;

      if (historicoChartInstance) {
        historicoChartInstance.data.datasets[0].data.push({
          x: Date.now(),
          y: message.dados.temperatura,
        });
        historicoChartInstance.update("quiet");
      }

      carregarEstatisticasDetalhes();
      carregarDadosVentilacao();
    }

    if (
      message.type === "atualizacao_status" &&
      message.dados.serial_number === serialNumber
    ) {
      console.log("Atualização de status recebida:", message.dados.status);
      atualizarPainelCompleto(message.dados.status);
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
  if (!voltage) return { text: "Verificando...", className: "bg-secondary" };
  if (voltage > 9)
    return {
      text: `Rede Elétrica (${voltage.toFixed(1)}V)`,
      className: "bg-status-ok",
    };
  return { text: "Apenas Bateria", className: "bg-status-warning" };
}

function atualizarStatusGeral() {
  const indicator = document.getElementById("geral-status-indicator");
  const pt100Badge = document.getElementById("diag-pt100-status");
  const alarmsList = document.getElementById("active-alarms-list");

  if (
    pt100Badge.classList.contains("bg-status-critical") ||
    alarmsList.querySelector(".alarm-item")
  ) {
    indicator.className = "status-indicator critical";
    indicator.setAttribute(
      "title",
      "Status Crítico: Falha no sensor ou alarme ativo!"
    );
  } else if (
    document
      .getElementById("diag-wifi-rssi")
      .classList.contains("bg-status-warning") ||
    document
      .getElementById("diag-battery-voltage")
      .classList.contains("bg-status-warning")
  ) {
    indicator.className = "status-indicator warning";
    indicator.setAttribute("title", "Aviso: Conexão fraca ou bateria baixa.");
  } else {
    indicator.className = "status-indicator ok";
    indicator.setAttribute("title", "Sistema operando normalmente.");
  }
  const tooltip = bootstrap.Tooltip.getInstance(indicator);
  if (tooltip)
    tooltip.setContent({ ".tooltip-inner": indicator.getAttribute("title") });
}

// Funções que já existiam e foram mantidas/adaptadas
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
