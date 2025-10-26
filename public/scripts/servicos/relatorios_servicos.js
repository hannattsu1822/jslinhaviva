document.addEventListener("DOMContentLoaded", () => {
  const ctxEncarregado = document
    .getElementById("graficoServicosPorEncarregado")
    ?.getContext("2d");
  const ctxDesligamento = document
    .getElementById("graficoServicosPorDesligamento")
    ?.getContext("2d");
  const ctxPorMes = document
    .getElementById("graficoServicosPorMes")
    ?.getContext("2d");
  const ctxStatusFinal = document
    .getElementById("graficoStatusFinalizacao")
    ?.getContext("2d");
  const tituloGraficoPorMesEl = document.getElementById("tituloGraficoPorMes");

  let chartEncarregado, chartDesligamento, chartPorMes, chartStatusFinal;

  const btnGerarRelatorios = document.getElementById("btnGerarRelatorios");
  const filtroPeriodoInicioEl = document.getElementById("filtroPeriodoInicio");
  const filtroPeriodoFimEl = document.getElementById("filtroPeriodoFim");
  const filtroEncarregadoRelEl = document.getElementById(
    "filtroEncarregadoRel"
  );
  const filtroStatusFinalEl = document.getElementById("filtroStatusFinal");
  const anoAtualEl = document.getElementById("anoAtual");
  if (anoAtualEl) anoAtualEl.textContent = new Date().getFullYear();

  if (btnGerarRelatorios) {
    btnGerarRelatorios.addEventListener("click", carregarTodosOsRelatorios);
  }

  async function popularFiltroEncarregados() {
    if (!filtroEncarregadoRelEl) return;
    try {
      const response = await fetch("/api/encarregados");
      if (response.ok) {
        const encarregados = await response.json();
        encarregados.forEach((enc) => {
          const option = document.createElement("option");
          option.value = enc.matricula;
          option.textContent = `${enc.nome} (${enc.matricula})`;
          filtroEncarregadoRelEl.appendChild(option);
        });
      }
    } catch (error) {
      console.error("Erro ao popular filtro de encarregados:", error);
    }
  }

  function getApiUrl(basePath) {
    const periodoInicio = filtroPeriodoInicioEl.value;
    const periodoFim = filtroPeriodoFimEl.value;
    const responsavel = filtroEncarregadoRelEl.value;
    const statusFinal = filtroStatusFinalEl.value;

    const params = new URLSearchParams();
    if (periodoInicio) params.append("inicio", periodoInicio);
    if (periodoFim) params.append("fim", periodoFim);
    if (responsavel) params.append("responsavel_matricula", responsavel);
    if (statusFinal) params.append("status_final", statusFinal);

    return `${basePath}${params.toString() ? "?" + params.toString() : ""}`;
  }

  function getApiUrlPorMes() {
    const responsavel = filtroEncarregadoRelEl.value;
    let ano = new Date().getFullYear();
    let tituloAno = ano;

    if (filtroPeriodoInicioEl.value && filtroPeriodoFimEl.value) {
      const anoInicio = new Date(filtroPeriodoInicioEl.value).getFullYear();
      const anoFim = new Date(filtroPeriodoFimEl.value).getFullYear();
      if (anoInicio === anoFim) {
        ano = anoInicio;
        tituloAno = ano;
      } else {
        tituloAno = `${anoInicio} - ${anoFim}`;
      }
    } else if (filtroPeriodoInicioEl.value) {
      ano = new Date(filtroPeriodoInicioEl.value).getFullYear();
      tituloAno = ano;
    } else if (filtroPeriodoFimEl.value) {
      ano = new Date(filtroPeriodoFimEl.value).getFullYear();
      tituloAno = ano;
    }

    const params = new URLSearchParams();
    params.append("ano", ano);
    if (responsavel) params.append("responsavel_matricula", responsavel);

    if (tituloGraficoPorMesEl)
      tituloGraficoPorMesEl.textContent = `Serviços Concluídos por Mês (${tituloAno})`;

    return `/api/relatorios/servicos-concluidos-por-mes?${params.toString()}`;
  }

  async function carregarRelatorioServicosPorEncarregado() {
    if (!ctxEncarregado) return;
    try {
      const url = getApiUrl("/api/relatorios/servicos-por-encarregado");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      const data = await response.json();

      const labels = data.map(
        (item) => item.responsavel_nome || item.responsavel_matricula || "N/A"
      );
      const totais = data.map((item) => item.total_servicos);

      if (chartEncarregado) chartEncarregado.destroy();
      chartEncarregado = new Chart(ctxEncarregado, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Nº de Serviços Finalizados",
              data: totais,
              backgroundColor: "rgba(54, 162, 235, 0.6)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          indexAxis: "y",
          scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar relatório por encarregado:", error);
    }
  }

  async function carregarRelatorioServicosPorDesligamento() {
    if (!ctxDesligamento) return;
    try {
      const url = getApiUrl("/api/relatorios/servicos-por-desligamento");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      const data = await response.json();

      const labels = data.map((item) =>
        item.desligamento === "SIM" ? "Com Desligamento" : "Sem Desligamento"
      );
      const totais = data.map((item) => item.total_servicos);

      if (chartDesligamento) chartDesligamento.destroy();
      chartDesligamento = new Chart(ctxDesligamento, {
        type: "pie",
        data: {
          labels: labels,
          datasets: [
            {
              data: totais,
              backgroundColor: [
                "rgba(255, 99, 132, 0.6)",
                "rgba(75, 192, 192, 0.6)",
              ],
              borderColor: ["rgba(255, 99, 132, 1)", "rgba(75, 192, 192, 1)"],
              borderWidth: 1,
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    } catch (error) {
      console.error("Erro ao carregar relatório por desligamento:", error);
    }
  }

  async function carregarRelatorioServicosPorMes() {
    if (!ctxPorMes) return;
    try {
      const url = getApiUrlPorMes();
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      const data = await response.json();

      const mesesNomes = [
        "Jan",
        "Fev",
        "Mar",
        "Abr",
        "Mai",
        "Jun",
        "Jul",
        "Ago",
        "Set",
        "Out",
        "Nov",
        "Dez",
      ];
      const labels = mesesNomes;
      const totais = Array(12).fill(0);
      data.forEach((item) => {
        if (item.mes >= 1 && item.mes <= 12) {
          totais[item.mes - 1] = item.total_servicos;
        }
      });

      if (chartPorMes) chartPorMes.destroy();
      chartPorMes = new Chart(ctxPorMes, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: `Serviços Concluídos`,
              data: totais,
              fill: false,
              borderColor: "rgb(75, 192, 192)",
              tension: 0.1,
            },
          ],
        },
        options: {
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    } catch (error) {
      console.error("Erro ao carregar relatório por mês:", error);
    }
  }

  async function carregarRelatorioStatusFinalizacao() {
    if (!ctxStatusFinal) return;
    try {
      const url = getApiUrl("/api/relatorios/status-finalizacao");
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao buscar dados");
      const data = await response.json();

      const labels = data.map((item) => {
        if (item.status === "concluido") return "Concluídos";
        if (item.status === "nao_concluido") return "Não Concluídos";
        return item.status;
      });
      const totais = data.map((item) => item.total_servicos);

      if (chartStatusFinal) chartStatusFinal.destroy();
      chartStatusFinal = new Chart(ctxStatusFinal, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              data: totais,
              backgroundColor: data.map((item) =>
                item.status === "concluido"
                  ? "rgba(40, 167, 69, 0.6)"
                  : "rgba(220, 53, 69, 0.6)"
              ),
              borderColor: data.map((item) =>
                item.status === "concluido"
                  ? "rgba(40, 167, 69, 1)"
                  : "rgba(220, 53, 69, 1)"
              ),
              borderWidth: 1,
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
    } catch (error) {
      console.error(
        "Erro ao carregar relatório de status de finalização:",
        error
      );
    }
  }

  function carregarTodosOsRelatorios() {
    if (ctxEncarregado) carregarRelatorioServicosPorEncarregado();
    if (ctxDesligamento) carregarRelatorioServicosPorDesligamento();
    if (ctxPorMes) carregarRelatorioServicosPorMes();
    if (ctxStatusFinal) carregarRelatorioStatusFinalizacao();
  }

  popularFiltroEncarregados().then(() => {
    carregarTodosOsRelatorios();
  });
});
