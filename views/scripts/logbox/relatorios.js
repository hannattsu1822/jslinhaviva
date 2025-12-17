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
  let dadosFiltrados = 0;

  const TEMP_LIMITS = {
    MIN_VALID: -40,
    MAX_VALID: 85
  };

  const showNotification = (message, type = "info") => {
    const notificationContainer = document.getElementById("notification-container") || createNotificationContainer();
    
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease-out forwards";
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  };

  const createNotificationContainer = () => {
    const container = document.createElement("div");
    container.id = "notification-container";
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
    
    if (!document.getElementById("notification-styles")) {
      const style = document.createElement("style");
      style.id = "notification-styles";
      style.textContent = `
        .notification {
          min-width: 300px;
          padding: 15px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: slideIn 0.3s ease-out;
          font-size: 14px;
          color: #fff;
        }
        .notification-success { background-color: #28a745; }
        .notification-error { background-color: #dc3545; }
        .notification-info { background-color: #17a2b8; }
        .notification-warning { background-color: #ffc107; color: #000; }
        .notification-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          margin-left: 15px;
          line-height: 1;
        }
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(400px); opacity: 0; }
        }
        .data-quality-warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 12px 16px;
          margin-bottom: 20px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .data-quality-warning-icon {
          font-size: 24px;
          color: #856404;
        }
        .data-quality-warning-text {
          color: #856404;
          font-size: 14px;
          margin: 0;
        }
      `;
      document.head.appendChild(style);
    }
    
    return container;
  };

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

    if (!deviceId) {
      showNotification("Por favor, selecione um dispositivo", "warning");
      return null;
    }

    switch (reportType) {
      case "detailed":
        date = detailedDatePicker.value;
        if (!date) {
          showNotification("Por favor, selecione uma data", "warning");
          return null;
        }
        break;
      case "monthly":
        month = monthlyDatePicker.value;
        if (!month) {
          showNotification("Por favor, selecione um mês", "warning");
          return null;
        }
        break;
      case "annual":
        year = annualDatePicker.value;
        if (!year || year.length !== 4) {
          showNotification("Por favor, digite um ano válido (4 dígitos)", "warning");
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

  const contarDadosInvalidos = (datasets) => {
    let count = 0;
    datasets.forEach(dataset => {
      if (dataset.data) {
        dataset.data.forEach(value => {
          if (value !== null && (value < TEMP_LIMITS.MIN_VALID || value > TEMP_LIMITS.MAX_VALID)) {
            count++;
          }
        });
      }
    });
    return count;
  };

  const exibirAvisoQualidadeDados = (quantidade) => {
    const reportContent = document.querySelector("#report-content-area");
    let avisoExistente = document.querySelector(".data-quality-warning");
    
    if (avisoExistente) {
      avisoExistente.remove();
    }

    if (quantidade > 0) {
      const aviso = document.createElement("div");
      aviso.className = "data-quality-warning";
      aviso.innerHTML = `
        <span class="data-quality-warning-icon">⚠️</span>
        <p class="data-quality-warning-text">
          <strong>Atenção:</strong> ${quantidade} leitura(s) com temperatura inválida foram filtradas do relatório 
          (valores fora do intervalo ${TEMP_LIMITS.MIN_VALID}°C a ${TEMP_LIMITS.MAX_VALID}°C).
        </p>
      `;
      reportContent.insertBefore(aviso, reportContent.firstChild);
    }
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

    dadosFiltrados = contarDadosInvalidos(data.chartData.datasets);
    exibirAvisoQualidadeDados(dadosFiltrados);

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
      data: {
        labels: data.chartData.labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500
        },
        scales: {
          y: {
            beginAtZero: false,
            min: TEMP_LIMITS.MIN_VALID,
            max: TEMP_LIMITS.MAX_VALID
          }
        }
      },
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
      tableBody.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center;">Nenhum dado disponível para o período selecionado</td></tr>`;
    } else {
      tableData.forEach(item => {
        const tr = document.createElement("tr");

        if (data.filters.reportType === 'detailed') {
          tr.innerHTML = `
            <td>${new Date(item.timestamp_inicio).toLocaleString("pt-BR")}</td>
            <td>${item.timestamp_fim ? new Date(item.timestamp_fim).toLocaleString("pt-BR") : "Em andamento"}</td>
            <td>${formatarDuracao(item.duracao_segundos)}</td>
          `;
        } else {
          tr.innerHTML = `
            <td>${item.dia}</td>
            <td>${item.count}</td>
            <td>${formatarDuracao(item.total_duration)}</td>
          `;
        }

        tableBody.appendChild(tr);
      });
    }
  };

  btnGenerateReport.addEventListener("click", async () => {
    const filters = getFilters();
    if (!filters) return;

    setLoadingState(true);

    try {
      const response = await fetch("/api/relatorios/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao gerar relatório");
      }

      const data = await response.json();
      currentFilters = filters;
      displayReportData(data);
      
      if (dadosFiltrados > 0) {
        showNotification(`Relatório gerado com ${dadosFiltrados} leitura(s) filtrada(s)`, "warning");
      } else {
        showNotification("Relatório gerado com sucesso!", "success");
      }
    } catch (error) {
      showNotification(error.message, "error");
      initialMessage.classList.remove("hidden");
    } finally {
      setLoadingState(false);
    }
  });

  btnExportPdf.addEventListener("click", async () => {
    if (!currentFilters) {
      showNotification("Gere um relatório antes de exportar", "warning");
      return;
    }

    btnExportPdf.disabled = true;
    btnExportPdf.textContent = "Gerando PDF...";

    try {
      const response = await fetch("/api/relatorios/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentFilters),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao gerar PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showNotification("PDF exportado com sucesso!", "success");
    } catch (error) {
      showNotification(error.message, "error");
    } finally {
      btnExportPdf.disabled = false;
      btnExportPdf.textContent = "Exportar PDF";
    }
  });

  setDefaultDates();
  updateFilterVisibility("detailed");
});
