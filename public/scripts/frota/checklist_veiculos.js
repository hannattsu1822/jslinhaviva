const checklistItems = [
  { id: "buzina", label: "Buzina" },
  { id: "cinto_seguranca", label: "Cinto de Segurança" },
  { id: "quebra_sol", label: "Quebra-sol" },
  { id: "retrovisor_inteiro", label: "Retrovisor Inteiro" },
  { id: "retrovisor_direito_esquerdo", label: "Retrovisor Direito/Esquerdo" },
  { id: "limpador_para_brisa", label: "Limpador de Para-brisa" },
  { id: "farol_baixa", label: "Farol de Baixa" },
  { id: "farol_alto", label: "Farol de Alta" },
  { id: "meia_luz", label: "Meia-luz" },
  { id: "luz_freio", label: "Luz de Freio" },
  { id: "luz_re", label: "Luz de Ré" },
  { id: "bateria", label: "Bateria" },
  { id: "luzes_painel", label: "Luzes do Painel" },
  { id: "seta_direita_esquerdo", label: "Seta Direita/Esquerda" },
  { id: "pisca_alerta", label: "Pisca-alerta" },
  { id: "luz_interna", label: "Luz Interna" },
  { id: "velocimetro_tacografo", label: "Velocímetro/Tacógrafo" },
  { id: "freios", label: "Freios" },
  { id: "macaco", label: "Macaco" },
  { id: "chave_roda", label: "Chave de Roda" },
  { id: "triangulo_sinalizacao", label: "Triângulo de Sinalização" },
  { id: "extintor_incendio", label: "Extintor de Incêndio" },
  { id: "portas_travas", label: "Portas e Travas" },
  { id: "sirene", label: "Sirene" },
  { id: "fechamento_janelas", label: "Fechamento de Janelas" },
  { id: "para_brisa", label: "Para-brisa" },
  { id: "oleo_motor", label: "Óleo do Motor" },
  { id: "oleo_freio", label: "Óleo de Freio" },
  { id: "nivel_agua_radiador", label: "Nível de Água do Radiador" },
  { id: "pneus_estado_calibragem", label: "Pneus (Estado e Calibragem)" },
  { id: "pneu_reserva_estepe", label: "Pneu Reserva/Estepe" },
  { id: "bancos_encosto_assentos", label: "Bancos e Encostos" },
  { id: "para_choque_dianteiro", label: "Para-choque Dianteiro" },
  { id: "para_choque_traseiro", label: "Para-choque Traseiro" },
  { id: "lataria", label: "Lataria" },
  { id: "estado_fisico_sky", label: "Estado Físico do Sky" },
  { id: "funcionamento_sky", label: "Funcionamento do Sky" },
  { id: "sapatas", label: "Sapatas" },
  { id: "cestos", label: "Cestos" },
  { id: "comandos", label: "Comandos" },
  { id: "lubrificacao", label: "Lubrificação" },
  { id: "ensaio_eletrico", label: "Ensaio Elétrico" },
  { id: "cilindros", label: "Cilindros" },
  { id: "gavetas", label: "Gavetas" },
  { id: "capas", label: "Capas" },
  { id: "nivel_oleo_sky", label: "Nível de Óleo do Sky" },
];

const placaSelect = document.getElementById("placa");
const dataInspecaoInput = document.getElementById("data_inspecao");
const agendamentoAbertoSelect = document.getElementById("agendamentoAberto");
const agendamentoIdHiddenInput = document.getElementById("agendamentoId");
const agendamentoMessage = document.getElementById("agendamentoMessage");
const matriculaSelect = document.getElementById("matricula");
const checklistFormEl = document.getElementById("checklistForm");

let loadedOpenAgendamentos = [];

async function carregarMotoristas() {
  try {
    const response = await fetch("/api/motoristas");
    if (!response.ok) throw new Error("Erro ao carregar motoristas.");
    const data = await response.json();
    if (!matriculaSelect) return;

    matriculaSelect.innerHTML =
      '<option value="">Selecione a matrícula</option>';
    data.forEach((motorista) => {
      const option = document.createElement("option");
      option.value = motorista.matricula;
      option.textContent = `${motorista.matricula} - ${motorista.nome}`;
      matriculaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar motoristas:", error);
    exibirMensagem("Erro ao carregar motoristas: " + error.message, "erro");
  }
}

async function carregarPlacas() {
  try {
    const response = await fetch("/api/placas");
    if (!response.ok) throw new Error("Erro ao carregar placas.");
    const data = await response.json();
    if (!placaSelect) return;

    placaSelect.innerHTML = '<option value="">Selecione a placa</option>';
    data.forEach((veiculo) => {
      const option = document.createElement("option");
      option.value = veiculo.placa;
      option.textContent = veiculo.placa;
      placaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar placas:", error);
    exibirMensagem("Erro ao carregar placas: " + error.message, "erro");
  }
}

function carregarItensChecklist() {
  const container = document.getElementById("checklist-items");
  if (!container) return;
  container.innerHTML = "";

  checklistItems.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "checklist-item";

    const label = document.createElement("label");
    label.textContent = item.label;
    label.htmlFor = `${item.id}_input`;

    const inputHidden = document.createElement("input");
    inputHidden.type = "hidden";
    inputHidden.name = item.id;
    inputHidden.id = `${item.id}_input`;
    inputHidden.value = "";

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "checklist-options";

    const conformeBtn = document.createElement("button");
    conformeBtn.type = "button";
    conformeBtn.className = "option-btn conforme";
    conformeBtn.textContent = "Conforme";
    conformeBtn.addEventListener("click", () => {
      inputHidden.value = "1";
      conformeBtn.classList.add("active");
      naoConformeBtn.classList.remove("active");
    });

    const naoConformeBtn = document.createElement("button");
    naoConformeBtn.type = "button";
    naoConformeBtn.className = "option-btn nao-conforme";
    naoConformeBtn.textContent = "Não Conforme";
    naoConformeBtn.addEventListener("click", () => {
      inputHidden.value = "0";
      naoConformeBtn.classList.add("active");
      conformeBtn.classList.remove("active");
    });

    optionsDiv.appendChild(conformeBtn);
    optionsDiv.appendChild(naoConformeBtn);

    itemDiv.appendChild(label);
    itemDiv.appendChild(inputHidden);
    itemDiv.appendChild(optionsDiv);

    container.appendChild(itemDiv);
  });
}

async function carregarAgendamentosAbertos() {
  const placa = placaSelect.value;

  agendamentoAbertoSelect.innerHTML =
    '<option value="">Carregando agendamentos...</option>';
  agendamentoAbertoSelect.disabled = true;
  agendamentoMessage.textContent = "";
  agendamentoMessage.className = "agendamento-message";
  agendamentoIdHiddenInput.value = "";

  placaSelect.disabled = false;
  matriculaSelect.disabled = false;

  if (!placa) {
    agendamentoAbertoSelect.innerHTML =
      '<option value="">Selecione um agendamento ou preencha manualmente</option>';
    agendamentoAbertoSelect.disabled = false;
    return;
  }

  try {
    const response = await fetch(
      `/api/agendamentos_abertos?placa=${placa}`,
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Erro ao buscar agendamentos em aberto."
      );
    }
    loadedOpenAgendamentos = await response.json();

    agendamentoAbertoSelect.innerHTML =
      '<option value="">Selecione um agendamento ou preencha manualmente</option>';

    if (loadedOpenAgendamentos.length === 0) {
      agendamentoMessage.textContent =
        "Nenhum agendamento em aberto para esta placa.";
      agendamentoMessage.classList.add("info");
    } else {
      agendamentoMessage.textContent = `${loadedOpenAgendamentos.length} agendamento(s) em aberto encontrado(s).`;
      agendamentoMessage.classList.add("success");
      loadedOpenAgendamentos.forEach((agendamento) => {
        const dataFormatada = new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const option = document.createElement("option");
        option.value = agendamento.id;
        option.textContent = `ID: ${agendamento.id} - Data: ${dataFormatada} - Encarregado: ${
          agendamento.encarregado_nome || "N/A"
        } (${agendamento.status_display})`;
        agendamentoAbertoSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Erro ao carregar agendamentos abertos:", error);
    agendamentoAbertoSelect.innerHTML =
      '<option value="">Erro ao carregar agendamentos</option>';
    agendamentoMessage.textContent =
      "Erro ao carregar agendamentos em aberto: " + error.message;
    agendamentoMessage.classList.add("error");
  } finally {
    agendamentoAbertoSelect.disabled = false;
  }
}

function preencherFormularioComAgendamento() {
  const selectedAgendamentoId = agendamentoAbertoSelect.value;
  const selectedAgendamento = loadedOpenAgendamentos.find(
    (ag) => String(ag.id) === selectedAgendamentoId
  );

  if (selectedAgendamento) {
    agendamentoIdHiddenInput.value = selectedAgendamento.id;

    placaSelect.value = selectedAgendamento.placa;
    placaSelect.disabled = true;

    exibirMensagem(
      `Agendamento ID ${selectedAgendamento.id} selecionado.`,
      "sucesso"
    );
  } else {
    agendamentoIdHiddenInput.value = "";
    placaSelect.disabled = false;
    exibirMensagem("Modo de inspeção manual ativado.", "info");
  }
}

async function salvarInspecao(event) {
  event.preventDefault();

  const botao = document.querySelector('#checklistForm button[type="submit"]');
  const textoOriginal = botao.innerHTML;
  const originalBgColor = botao.style.backgroundColor;
  botao.disabled = true;
  botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  const form = document.getElementById("checklistForm");
  const formData = new FormData(form);
  const dados = {};

  for (const [chave, valor] of formData.entries()) {
    if (valor === "1" && checklistItems.some((item) => item.id === chave)) {
      dados[chave] = 1;
    } else if (
      valor === "0" &&
      checklistItems.some((item) => item.id === chave)
    ) {
      dados[chave] = 0;
    } else if (
      valor === "" &&
      checklistItems.some((item) => item.id === chave)
    ) {
      dados[chave] = null;
    } else {
      dados[chave] = valor.trim() === "" ? null : valor;
    }
  }

  if (placaSelect.disabled) {
    dados.placa = placaSelect.value;
  }
  if (dataInspecaoInput.disabled) {
    dados.data_inspecao = dataInspecaoInput.value;
  }

  dados.agendamento_id = agendamentoIdHiddenInput.value || null;

  if (loadedOpenAgendamentos.length > 0 && !dados.agendamento_id) {
    exibirMensagem(
      "Existem agendamentos em aberto para esta placa. Por favor, selecione um agendamento para continuar.",
      "erro"
    );
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
    botao.style.backgroundColor = originalBgColor;
    return;
  }

  if (
    !dados.matricula ||
    !dados.placa ||
    !dados.data_inspecao ||
    dados.km_atual === null ||
    dados.horimetro === null
  ) {
    exibirMensagem(
      "Preencha todos os campos obrigatórios: Matrícula, Placa, Data, KM e Horímetro.",
      "erro"
    );
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
    botao.style.backgroundColor = originalBgColor;
    return;
  }
  let checklistCompleto = true;
  checklistItems.forEach((item) => {
    if (dados[item.id] === null || dados[item.id] === "") {
      checklistCompleto = false;
    }
  });

  if (!checklistCompleto) {
    exibirMensagem(
      'Por favor, marque "Conforme" ou "Não Conforme" para todos os itens de verificação.',
      "erro"
    );
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
    botao.style.backgroundColor = originalBgColor;
    return;
  }

  try {
    const response = await fetch("/api/salvar_inspecao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(dados),
    });

    const resultado = await response.json();

    if (response.ok) {
      exibirMensagem(
        resultado.message || "Inspeção salva com sucesso!",
        "sucesso"
      );

      botao.innerHTML = '<i class="fas fa-check"></i> Salvo!';
      botao.style.backgroundColor = "#28a745";

      form.reset();
      carregarItensChecklist();

      setTimeout(() => {
        if (dados.agendamento_id) {
          window.location.href = "/agendar_checklist";
        } else {
          window.location.href = "/frota";
        }
      }, 1500);
    } else {
      throw new Error(resultado.message || "Erro ao salvar inspeção");
    }
  } catch (error) {
    console.error("Erro na requisição fetch para salvar inspeção:", error);
    exibirMensagem(error.message, "erro");

    botao.disabled = false;
    botao.innerHTML = textoOriginal;
    botao.style.backgroundColor = originalBgColor;
  }
}

function exibirMensagem(texto, tipo = "sucesso") {
  const div = document.getElementById("mensagem");
  if (!div) return;
  div.textContent = texto;
  div.className = `mensagem ${tipo}`;
  setTimeout(() => {
    div.textContent = "";
    div.className = "mensagem";
  }, 5000);
}

document.addEventListener("DOMContentLoaded", async () => {
  await carregarMotoristas();
  await carregarPlacas();
  carregarItensChecklist();

  if (placaSelect) {
    placaSelect.addEventListener("change", carregarAgendamentosAbertos);
  }
  if (agendamentoAbertoSelect) {
    agendamentoAbertoSelect.addEventListener(
      "change",
      preencherFormularioComAgendamento
    );
  }

  if (checklistFormEl) {
    checklistFormEl.addEventListener("submit", salvarInspecao);
  }
});
