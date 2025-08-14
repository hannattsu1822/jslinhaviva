document.addEventListener("DOMContentLoaded", () => {
  const deviceSelect = document.getElementById("device-select");
  const startDateInput = document.getElementById("start-date");
  const endDateInput = document.getElementById("end-date");
  const btnGenerateVisual = document.getElementById("btn-generate-visual");
  const btnGeneratePdf = document.getElementById("btn-generate-pdf");
  const reportContainer = document.getElementById("report-container");
  const loader = document.getElementById("loader-report");
  let reportChartInstance = null;

  const formatarDuracao = (segundos) => {
    if (segundos === null || segundos === undefined) return "Em andamento";
    if (segundos < 60) return `${segundos} seg`;
    if (segundos < 3600)
      return `${Math.floor(segundos / 60)} min ${segundos % 60} seg`;
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    return `${horas}h ${minutos}min`;
  };

  const getFilters = () => {
    const deviceId = deviceSelect.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
      alert("Por favor, selecione as datas de início e fim.");
      return null;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert("A data de início não pode ser posterior à data de fim.");
      return null;
    }
    return { deviceId, startDate, endDate };
  };

  const displayReportData = (data) => {
    document.getElementById(
      "report-title"
    ).textContent = `Relatório de Monitoramento - ${data.device.local_tag}`;
    const start = new Date(data.filters.startDate).toLocaleString("pt-BR");
    const end = new Date(data.filters.endDate).toLocaleString("pt-BR");
    document.getElementById(
      "report-period"
    ).textContent = `Período: ${start} até ${end}`;

    document.getElementById("stat-min").textContent = `${parseFloat(
      data.stats.temp_min || 0
    ).toFixed(2)} °C`;
    document.getElementById("stat-avg").textContent = `${parseFloat(
      data.stats.temp_avg || 0
    ).toFixed(2)} °C`;
    document.getElementById("stat-max").textContent = `${parseFloat(
      data.stats.temp_max || 0
    ).toFixed(2)} °C`;

    if (reportChartInstance) {
      reportChartInstance.destroy();
    }
    const ctx = document.getElementById("report-chart").getContext("2d");
    reportChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.chartData.labels,
        datasets: [
          {
            label: "Temperatura (°C)",
            data: data.chartData.datasets[0].data,
            borderColor: "rgba(255, 99, 132, 1)",
            tension: 0.1,
          },
        ],
      },
      options: { responsive: true, animation: { duration: 0 } },
    });

    const tableBody = document.querySelector("#report-fan-table tbody");
    tableBody.innerHTML = "";
    if (data.fanHistory.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="3" style="text-align:center;">Nenhum acionamento no período.</td></tr>';
    } else {
      data.fanHistory.forEach((item) => {
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
  };

  btnGenerateVisual.addEventListener("click", async () => {
    const filters = getFilters();
    if (!filters) return;

    loader.style.display = "block";
    reportContainer.style.display = "none";

    try {
      const response = await fetch("/api/relatorios/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erro ao gerar relatório.");
      }

      const data = await response.json();
      displayReportData(data);
      reportContainer.style.display = "block";
    } catch (error) {
      alert(`Erro: ${error.message}`);
    } finally {
      loader.style.display = "none";
    }
  });

  btnGeneratePdf.addEventListener("click", async () => {
    const filters = getFilters();
    if (!filters) return;

    btnGeneratePdf.disabled = true;
    btnGeneratePdf.innerHTML =
      '<span class="material-icons">hourglass_top</span> Gerando...';

    try {
      const response = await fetch("/api/relatorios/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Erro ao gerar PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "relatorio-monitoramento.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    } finally {
      btnGeneratePdf.disabled = false;
      btnGeneratePdf.innerHTML =
        '<span class="material-icons">picture_as_pdf</span> Exportar PDF';
    }
  });
});
