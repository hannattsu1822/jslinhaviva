let accessDeniedModalInstance;
let developmentModalInstance;

document.addEventListener("DOMContentLoaded", async function () {
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    const admEl = document.getElementById("access-denied-modal");
    if (admEl) accessDeniedModalInstance = new bootstrap.Modal(admEl);

    const devmEl = document.getElementById("development-modal");
    if (devmEl) developmentModalInstance = new bootstrap.Modal(devmEl);
  }

  const calendarEl = document.getElementById("dashboard-calendar");
  if (!calendarEl) {
    console.error("Elemento do calendário do dashboard não encontrado!");
    return;
  }

  const userString = localStorage.getItem("user");
  let loggedInUserMatricula = null;
  let loggedInUserCargo = null;

  if (userString) {
    try {
      const user = JSON.parse(userString);
      loggedInUserMatricula = user.matricula;
      loggedInUserCargo = user.cargo;
    } catch (e) {
      console.error("Erro ao parsear dados do usuário do localStorage:", e);
    }
  }

  if (!loggedInUserMatricula) {
    calendarEl.innerHTML =
      '<p class="text-center text-danger py-5">Não foi possível identificar o usuário logado para carregar os checklists.</p>';
    return;
  }

  const viewAllRoles = ["ADM", "ADMIN", "Gerente", "Engenheiro", "Técnico"];
  const canViewAllChecklists = viewAllRoles.includes(loggedInUserCargo);

  let agendamentos = [];
  try {
    const response = await fetch("/api/agendamentos_checklist", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(
        `Erro ao carregar agendamentos para o calendário: ${
          response.status
        } - ${errorData.message || response.statusText}`
      );
    }

    agendamentos = await response.json();

    if (agendamentos.length === 0) {
      calendarEl.innerHTML =
        '<p class="text-center text-muted py-5">Nenhum agendamento de checklist encontrado.</p>';
      return;
    }
  } catch (error) {
    console.error(
      "Erro ao carregar agendamentos para o calendário do dashboard:",
      error
    );
    calendarEl.innerHTML = `<p class="text-center text-danger py-5">Erro ao carregar agendamentos: ${error.message}</p>`;
    return;
  }

  const events = [];
  const todayNormalized = new Date();
  todayNormalized.setHours(0, 0, 0, 0); // Normaliza a data de hoje para o início do dia

  agendamentos.forEach((agendamento) => {
    if (
      canViewAllChecklists ||
      agendamento.encarregado_matricula === loggedInUserMatricula
    ) {
      let eventColor = "#007bff"; // Cor padrão para 'Agendado'
      let eventClassName = "checklist-event-highlight"; // Classe base para todos os eventos de checklist

      const agendamentoDate = new Date(agendamento.data_agendamento);
      agendamentoDate.setHours(0, 0, 0, 0); // Normaliza a data do agendamento

      const diffTime = agendamentoDate.getTime() - todayNormalized.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Calcula a diferença em dias

      let statusCategory = agendamento.status_display; // Usa o status do backend

      // Lógica para determinar "Pra Vencer"
      if (statusCategory === "Agendado" && diffDays > 0 && diffDays <= 7) {
        statusCategory = "PraVencer"; // Categoria customizada para "Pra Vencer"
      }

      // Atribui cor e classe com base na categoria de status
      switch (statusCategory) {
        case "Concluído":
          eventColor = "#28a745"; // Verde
          eventClassName += " status-concluido";
          break;
        case "Atrasado":
          eventColor = "#dc3545"; // Vermelho
          eventClassName += " status-atrasado";
          break;
        case "PraVencer":
          eventColor = "#ffc107"; // Amarelo
          eventClassName += " status-pra-vencer";
          break;
        case "Agendado": // Se for 'Agendado' e não 'PraVencer'
        default:
          eventColor = "#007bff"; // Azul
          eventClassName += " status-agendado";
          break;
      }

      events.push({
        id: agendamento.id,
        title: `${agendamento.placa} (${
          agendamento.encarregado_nome || "N/A"
        })`,
        start: agendamento.data_agendamento,
        allDay: true,
        color: eventColor, // FullCalendar usa esta cor como primária/fallback
        className: eventClassName, // Classes CSS customizadas
        extendedProps: {
          // Propriedades adicionais para depuração ou uso futuro
          status: agendamento.status_display,
          statusCategory: statusCategory,
          veiculo_id: agendamento.veiculo_id,
          encarregado_matricula: agendamento.encarregado_matricula,
        },
      });
    }
  });

  calendarEl.innerHTML = "";

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "pt-br",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    buttonText: {
      today: "Hoje",
      month: "Mês",
      week: "Semana",
      day: "Dia",
    },
    events: events,
    showNonCurrentDates: false,
    fixedWeekCount: false,
    eventDidMount: function (info) {},
  });

  calendar.render();
});
