document.addEventListener("DOMContentLoaded", () => {
  const reportTypeSelector = document.getElementById("report-type-selector");
  const deviceSelect = document.getElementById("device-select");
  const datePickersContainer = document.getElementById("date-pickers");
  const detailedDatePicker = document.getElementById("date-input-detailed");
  const monthlyDatePicker = document.getElementById("date-input-monthly");
  const annualDatePicker = document.getElementById("date-input-annual");
  const btnGenerateReport = document.getElementById("btn-generate-report");
  const btnExportPdf = document.getElementById("btn-export-pdf");

  const initialMessage = document.getElementById("initial-message");
  const loader = document.getElementById("loader");
  const reportContentArea = document.getElementById("report-content-area");

  let reportChartInstance = null;
  let currentFilters = null;

  const setDefaultDates = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    detailedDatePicker.value = `${yyyy}-${mm}-${dd}`;
    monthlyDatePicker.value = `${yyyy}-${mm}`;
    annualDatePicker.value = yyyy;
  };

  const updateFilterVisibility = (activeType) => {
    reportTypeSelector.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === activeType);
    });

    datePickersContainer.querySelectorAll(".date-picker").forEach((picker) => {
      picker.classList.add("hidden");
    });

    document.getElementById(`date-input-${activeType}`).classList.remove("hidden");
  };

  reportTypeSelector.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      const type = e.target.dataset.type;
      updateFilterVisibility(type);
    }
  });

  const getFilters = () => {
    const reportType = reportTypeSelector.querySelector("button.active").dataset.type;
    const deviceId = deviceSelect.value;
    let date, month, year;

    switch (reportType) {
      case "detailed":
        date = detailedDatePicker.value;
        if (!date) {
          alert("Por favor, selecione uma data.");
          return null;
        }
        break;
      case "monthly":
        month = monthlyDatePicker.value;
        if (!month) {
          alert("Por favor, selecione um mês.");
          return null;
        }
        break;
      case "annual":
        year = annualDatePicker.value;
        if (!year || year.length !== 4) {
          alert("Por favor, digite um ano válido (4 dígitos).");
          return null;
        }
        break;
    }
    return { deviceId, reportType, date, month, year };
  };

  const setLoadingState = (isLoading) => {
    initialMessage.classList.add("hidden");
    loader.classList.toggle("hidden", !isLoading);
    reportContentArea.classList.toggle("hidden", isLoading);
    btnGenerateReport.disabled = isLoading;
    btnExportPdf.disabled = isLoading || !currentFilters;
  };

  const formatarDuracao = (segundos) => {
    if (segundos === null || segundos === undefined || isNaN(segundos)) return "0 seg";
    segundos = Math.round(segundos);
    if (segundos < 60) return `${segundos} seg`;
    if (segundos < 3600) return `${Math.floor(segundos / 60)} min ${segundos % 60} seg`;
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    return `${horas}h ${minutos}min`;
  };

  const displayReportData = (data) => {
    document.getElementById("report-title").textContent = `Relatório de Monitoramento - ${data.device.local_tag}`;
    const start = new Date(data.filters.startDate).toLocaleDateString("pt-BR", { timeZone: 'UTC' });
    const end = new Date(data.filters.endDate).toLocaleDateString("pt-BR", { timeZone: 'UTC' });
    document.getElementById("report-period").textContent = `Período: ${start} a ${end}`;

    document.getElementById("kpi-avg-temp").textContent = parseFloat(data.stats.temp_avg || 0).toFixed(2);
    document.getElementById("kpi-max-temp").textContent = parseFloat(data.stats.temp_max || 0).toFixed(2);
    document.getElementById("kpi-min-temp").textContent = parseFloat(data.stats.temp_min || 0).toFixed(2);
    document.getElementById("kpi-fan-count").textContent = data.stats.total_count || 0;

    if (reportChartInstance) {
      reportChartInstance.destroy();
    }
    const ctx = document.getElementById("report-chart").getContext("2d");
    const datasets = [];
    if (data.filters.reportType === 'detailed') {
        datasets.push({
            label: "Temperatura (°C)",
            data: data.chartData.datasets[1].data,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
            tension: 0.1,
        });
    } else {
        datasets.push({
            label: "Temp. Mínima (°C)",
            data: data.chartData.datasets[0].data,
            borderColor: "rgba(54, 162, 235, 1)",
            fill: false,
        });
        datasets.push({
            label: "Temp. Média (°C)",
            data: data.chartData.datasets[1].data,
            borderColor: "rgba(255, 159, 64, 1)",
            backgroundColor: "rgba(255, 159, 64, 0.1)",
            fill: 'origin',
        });
        datasets.push({
            label: "Temp. Máxima (°C)",
            data: data.chartData.datasets[2].data,
            borderColor: "rgba(255, 99, 132, 1)",
            fill: false,
        });
    }
    reportChartInstance = new Chart(ctx, {
      type: "line",
      data: { labels: data.chartData.labels, datasets: datasets },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 500 } },
    });

    const tableHeader = document.getElementById("report-table-header");
    const tableBody = document.getElementById("report-table-body");
    tableHeader.innerHTML = "";
    tableBody.innerHTML = "";

    let headers = [];
    let tableData = [];
    if (data.filters.reportType === 'detailed') {
        document.getElementById("table-title").textContent = "Histórico Detalhado de Acionamentos";
        headers = ["Início", "Fim", "Duração"];
        tableData = data.fanHistory;
    } else {
        document.getElementById("table-title").textContent = "Resumo de Acionamentos";
        headers = ["Período", "Nº de Acionamentos", "Tempo Total Ligado"];
        tableData = data.fanHistoryAgregado;
    }

    headers.forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        tableHeader.appendChild(th);
    });

    if (tableData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${headers.length}" style="text-align:center;">Nenhum acionamento no período.</td></tr>`;
    } else {
        tableData.forEach(item => {
            const row = tableBody.insertRow();
            if (data.filters.reportType === 'detailed') {
                row.insertCell(0).textContent = new Date(item.timestamp_inicio).toLocaleString("pt-BR");
                row.insertCell(1).textContent = item.timestamp_fim ? new Date(item.timestamp_fim).toLocaleString("pt-BR") : "Ativa";
                row.insertCell(2).textContent = formatarDuracao(item.duracao_segundos);
            } else {
                row.insertCell(0).textContent = item.dia || item.mes;
                row.insertCell(1).textContent = item.count;
                row.insertCell(2).textContent = formatarDuracao(item.total_duration);
            }
        });
    }
  };

  btnGenerateReport.addEventListener("click", async () => {
    const filters = getFilters();
    if (!filters) return;

    currentFilters = filters;
    setLoadingState(true);

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
    } catch (error) {
      alert(`Erro: ${error.message}`);
      initialMessage.classList.remove("hidden");
      reportContentArea.classList.add("hidden");
    } finally {
      setLoadingState(false);
    }
  });

  btnExportPdf.addEventListener("click", async () => {
    if (!currentFilters) {
        alert("Gere um relatório visual primeiro.");
        return;
    }

    btnExportPdf.disabled = true;
    btnExportPdf.innerHTML = '<div class="spinner-small"></div> Exportando...';

    try {
      const response = await fetch("/api/relatorios/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentFilters),
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
      a.download = `relatorio-${currentFilters.reportType}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    } finally {
      btnExportPdf.disabled = false;
      btnExportPdf.innerHTML = '<span class="material-icons">picture_as_pdf</span> Exportar PDF';
    }
  });

  setDefaultDates();
  updateFilterVisibility("detailed");
});
