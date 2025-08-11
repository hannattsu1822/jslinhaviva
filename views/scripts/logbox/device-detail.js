let historicoChartInstance = null;

function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return "Em andamento";
  if (segundos < 60) return `${segundos} seg`;
  if (segundos < 3600)
    return `${Math.floor(segundos / 60)} min ${segundos % 60} seg`;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  return `${horas}h ${minutos}min`;
}

function atualizarCards(dados) {
  document.getElementById(
    "latest-temp"
  ).textContent = `${dados.temperatura.toFixed(1)} °C`;
  document.getElementById("latest-bat").textContent = `${dados.bateria.toFixed(
    2
  )} V`;
  document.getElementById(
    "latest-timestamp"
  ).textContent = `Em: ${dados.timestamp_leitura}`;

  const powerIcon = document
    .getElementById("power-source-icon")
    .querySelector(".material-icons");
  const powerText = document.getElementById("power-source-text");
  if (dados.fonte_alimentacao === "Alimentação Direta") {
    powerIcon.textContent = "power";
    powerText.textContent = "Rede Elétrica";
  } else {
    powerIcon.textContent = "battery_alert";
    powerText.textContent = "Bateria";
  }

  const batteryStatus = document.getElementById("battery-status");
  if (dados.bateria < 4.5) {
    batteryStatus.textContent = "Crítica";
    batteryStatus.style.color = "#e74c3c";
  } else if (dados.bateria < 4.8) {
    batteryStatus.textContent = "Baixa";
    batteryStatus.style.color = "#f39c12";
  } else {
    batteryStatus.textContent = "Normal";
    batteryStatus.style.color = "#27ae60";
  }
}

function gerarGraficoHistorico(dados) {
  const ctx = document.getElementById("graficoHistorico").getContext("2d");

  const initialData = dados.labels.map((label, index) => ({
    x: new Date(
      label.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")
    ).getTime(), // Corrige formato de data para JS
    y: dados.temperaturas[index],
  }));

  historicoChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Temperatura (°C)",
          data: initialData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          fill: true,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: "realtime",
          realtime: {
            duration: 600000, // Janela de 10 minutos
            refresh: 5000, // Atualiza o gráfico a cada 5 segundos
            delay: 2000, // Atraso para agrupar pontos
            onRefresh: (chart) => {
              // Esta função será chamada pelo WebSocket
            },
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
    const statsResponse = await fetch(
      `/api/logbox-device/${serialNumber}/ventilation-stats`
    );
    const stats = await statsResponse.json();
    document.getElementById("fan-today-count").textContent = stats.today.count;
    document.getElementById("fan-today-duration").textContent = formatarDuracao(
      stats.today.duration
    );
    document.getElementById("fan-month-count").textContent = stats.month.count;
    document.getElementById("fan-month-duration").textContent = formatarDuracao(
      stats.month.duration
    );

    const historyResponse = await fetch(
      `/api/logbox-device/${serialNumber}/ventilation-history`
    );
    const history = await historyResponse.json();
    const tableBody = document.querySelector("#fan-history-table tbody");
    tableBody.innerHTML = "";
    if (history.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;">Nenhum acionamento registrado.</td></tr>';
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

async function carregarDadosIniciais() {
  const loader = document.getElementById("loader-historico");
  const canvas = document.getElementById("graficoHistorico");
  try {
    loader.style.display = "block";
    const latestResponse = await fetch(
      `/api/logbox-device/${serialNumber}/latest`
    );
    const latestData = await latestResponse.json();
    if (latestData.payload) {
      const payloadObjeto = JSON.parse(latestData.payload);
      const dadosCard = {
        temperatura: payloadObjeto.value_channels[2],
        bateria: payloadObjeto.battery,
        timestamp_leitura: new Date(
          latestData.timestamp_leitura
        ).toLocaleString("pt-BR"),
        fonte_alimentacao: latestData.fonte_alimentacao,
      };
      atualizarCards(dadosCard);
    }

    const historyResponse = await fetch(
      `/api/logbox-device/${serialNumber}/leituras`
    );
    if (!historyResponse.ok) throw new Error("Falha ao buscar histórico");
    const historyData = await historyResponse.json();
    loader.style.display = "none";
    canvas.style.display = "block";
    gerarGraficoHistorico(historyData);
  } catch (error) {
    console.error("Erro ao carregar dados iniciais:", error);
    loader.innerHTML = "Erro ao carregar dados.";
  }
}

function iniciarWebSocket() {
  const socket = new WebSocket(`ws://${window.location.host}`);
  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (
      message.type === "nova_leitura" &&
      message.dados.serial_number === serialNumber
    ) {
      console.log(
        "Nova leitura recebida para este dispositivo:",
        message.dados
      );

      const dadosParaCards = { ...message.dados, umidade: 0 }; // Adiciona umidade=0 para a função não quebrar
      atualizarCards(dadosParaCards);
      carregarDadosVentilacao();

      const logList = document.getElementById("realtime-log-list-detail");
      const novaEntrada = document.createElement("li");
      const dados = message.dados;
      novaEntrada.textContent = `[${dados.timestamp_leitura}] Temp: ${dados.temperatura}°C, Bat: ${dados.bateria}V, Fonte: ${dados.fonte_alimentacao}`;
      logList.prepend(novaEntrada);
      while (logList.children.length > 15) {
        logList.removeChild(logList.lastChild);
      }

      // Adiciona o novo ponto ao gráfico em tempo real
      if (historicoChartInstance) {
        historicoChartInstance.data.datasets[0].data.push({
          x: Date.now(),
          y: dados.temperatura,
        });
        historicoChartInstance.update("quiet");
      }
    }
  };
  socket.onopen = function () {
    console.log("Conexão WebSocket estabelecida.");
  };
  socket.onclose = function () {
    console.log("Conexão WebSocket fechada. Tentando reconectar em 5s...");
    setTimeout(iniciarWebSocket, 5000);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  carregarDadosIniciais();
  carregarEstatisticasDetalhes();
  carregarDadosVentilacao();
  iniciarWebSocket();
});
