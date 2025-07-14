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

  let allVehiclesInCycle = [];
  try {
    const response = await fetch("/api/placas", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Erro desconhecido" }));
      throw new Error(
        `Erro ao carregar veículos para o calendário: ${response.status} - ${
          errorData.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    allVehiclesInCycle = data;

    if (allVehiclesInCycle.length === 0) {
      calendarEl.innerHTML =
        '<p class="text-center text-muted py-5">Nenhum veículo configurado para agendamento de checklists semanais.</p>';
      return;
    }
  } catch (error) {
    console.error(
      "Erro ao carregar veículos para o calendário do dashboard:",
      error
    );
    calendarEl.innerHTML = `<p class="text-center text-danger py-5">Erro ao carregar veículos: ${error.message}</p>`;
    return;
  }

  const events = [];
  const today = new Date();
  const numYearsToDisplay = 2;

  for (let yearOffset = 0; yearOffset < numYearsToDisplay; yearOffset++) {
    const year = today.getFullYear() + yearOffset;

    for (let month = 0; month < 12; month++) {
      let monthlyCycleCounter = 0;
      let currentMonthStart = new Date(year, month, 1);

      let firstMondayOfMonth = new Date(currentMonthStart);
      while (firstMondayOfMonth.getDay() !== 1) {
        firstMondayOfMonth.setDate(firstMondayOfMonth.getDate() + 1);
      }

      let currentMonday = new Date(firstMondayOfMonth);
      while (currentMonday.getMonth() === month) {
        const vehicleIndex = monthlyCycleCounter % allVehiclesInCycle.length;
        const vehicleForThisWeek = allVehiclesInCycle[vehicleIndex];

        if (
          vehicleForThisWeek &&
          (canViewAllChecklists ||
            vehicleForThisWeek.encarregado_matricula === loggedInUserMatricula)
        ) {
          events.push({
            title: `${vehicleForThisWeek.placa} (${
              vehicleForThisWeek.encarregado_nome || "N/A"
            })`,
            start: currentMonday.toISOString().split("T")[0],
            allDay: true,
            className: "checklist-event-highlight",
            color: "#007bff",
          });
        }

        monthlyCycleCounter++;
        currentMonday.setDate(currentMonday.getDate() + 7);
      }
    }
  }

  // CORREÇÃO AQUI: Limpar o conteúdo do elemento antes de renderizar o calendário
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
