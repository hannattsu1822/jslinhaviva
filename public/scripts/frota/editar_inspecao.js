// public/scripts/frota/editar_inspecao.js

const mapeamentoNomes = {
  buzina: "Buzina",
  cinto_seguranca: "Cinto de Segurança",
  quebra_sol: "Quebra-sol",
  retrovisor_inteiro: "Retrovisor Inteiro",
  retrovisor_direito_esquerdo: "Retrovisor Direito/Esquerdo",
  limpador_para_brisa: "Limpador de Para-brisa",
  farol_baixa: "Farol de Baixa",
  farol_alto: "Farol de Alta",
  meia_luz: "Meia-luz",
  luz_freio: "Luz de Freio",
  luz_re: "Luz de Ré",
  bateria: "Bateria",
  luzes_painel: "Luzes do Painel",
  seta_direita_esquerdo: "Seta Direita/Esquerda",
  pisca_alerta: "Pisca-alerta",
  luz_interna: "Luz Interna",
  velocimetro_tacografo: "Velocímetro/Tacógrafo",
  freios: "Freios",
  macaco: "Macaco",
  chave_roda: "Chave de Roda",
  triangulo_sinalizacao: "Triângulo de Sinalização",
  extintor_incendio: "Extintor de Incêndio",
  portas_travas: "Portas e Travas",
  sirene: "Sirene",
  fechamento_janelas: "Fechamento de Janelas",
  para_brisa: "Para-brisa",
  oleo_motor: "Óleo do Motor",
  oleo_freio: "Óleo de Freio",
  nivel_agua_radiador: "Nível de Água do Radiador",
  pneus_estado_calibragem: "Pneus (Estado e Calibragem)",
  pneu_reserva_estepe: "Pneu Reserva/Estepe",
  bancos_encosto_assentos: "Bancos e Encostos",
  para_choque_dianteiro: "Para-choque Dianteiro",
  para_choque_traseiro: "Para-choque Traseiro",
  lataria: "Lataria",
  estado_fisico_sky: "Estado Físico do Sky",
  funcionamento_sky: "Funcionamento do Sky",
  sapatas: "Sapatas",
  cestos: "Cestos",
  comandos: "Comandos",
  lubrificacao: "Lubrificação",
  ensaio_eletrico: "Ensaio Elétrico",
  cilindros: "Cilindros",
  gavetas: "Gavetas",
  capas: "Capas",
  nivel_oleo_sky: "Nível de Óleo do Sky",
};

async function carregarMotoristas() {
  try {
    const response = await fetch("/api/motoristas");
    if (!response.ok) throw new Error("Erro ao carregar motoristas");
    const data = await response.json();
    const matriculaSelect = document.getElementById("matricula");
    if (!matriculaSelect) return;

    matriculaSelect.innerHTML =
      '<option value="">Selecione uma matrícula</option>';
    data.forEach((motorista) => {
      const option = document.createElement("option");
      option.value = motorista.matricula;
      option.textContent = `${motorista.matricula} - ${motorista.nome}`;
      matriculaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar motoristas:", error);
  }
}

async function carregarPlacas() {
  try {
    const response = await fetch("/api/placas");
    if (!response.ok) throw new Error("Erro ao carregar placas");
    const data = await response.json();
    const placaSelect = document.getElementById("placa");
    if (!placaSelect) return;

    placaSelect.innerHTML = '<option value="">Selecione uma placa</option>';
    data.forEach((veiculo) => {
      const option = document.createElement("option");
      option.value = veiculo.placa;
      option.textContent = veiculo.placa;
      placaSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar placas:", error);
  }
}

async function carregarInspecao() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    alert("ID da inspeção não encontrado!");
    window.location.href = "/filtrar_veiculos";
    return;
  }

  try {
    const response = await fetch(`/api/editar_inspecao/${id}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || "Erro ao carregar dados da inspeção para edição"
      );
    }
    const inspecao = await response.json(); // Dados da inspeção vêm diretamente aqui

    // Verificando se 'inspecao' em si é um objeto válido (pode ser um array vazio se não encontrado, por exemplo)
    if (
      !inspecao ||
      typeof inspecao !== "object" ||
      Object.keys(inspecao).length === 0
    ) {
      throw new Error("Dados da inspeção não encontrados ou formato inválido.");
    }
    // Não precisamos mais de 'inspecao.data' ou 'dadosInspecao'
    // Usaremos 'inspecao' diretamente

    document.getElementById("matricula").value = inspecao.matricula;
    document.getElementById("placa").value = inspecao.placa;

    if (inspecao.data_inspecao) {
      const dataObj = new Date(inspecao.data_inspecao);
      if (!isNaN(dataObj.getTime())) {
        document.getElementById("data_inspecao").value = dataObj
          .toISOString()
          .split("T")[0];
      }
    }

    document.getElementById("km_atual").value = inspecao.km_atual;
    document.getElementById("horimetro").value = inspecao.horimetro;
    document.getElementById("observacoes").value = inspecao.observacoes || "";

    const checklistItemsContainer = document.getElementById("checklist-items");
    if (!checklistItemsContainer) return;
    checklistItemsContainer.innerHTML = "";

    for (const key in mapeamentoNomes) {
      if (mapeamentoNomes.hasOwnProperty(key)) {
        const checklistItem = document.createElement("div");
        checklistItem.className = "checklist-item";

        const itemNome = document.createElement("span");
        itemNome.textContent = mapeamentoNomes[key];
        checklistItem.appendChild(itemNome);

        const checkboxesDiv = document.createElement("div");
        checkboxesDiv.className = "checkboxes";

        const conformeLabel = document.createElement("label");
        const conformeInput = document.createElement("input");
        conformeInput.type = "checkbox";
        conformeInput.name = key;
        conformeInput.value = "true";
        conformeInput.onchange = function () {
          marcarApenasUm(this);
        };
        if (inspecao[key] === true || inspecao[key] === 1) {
          conformeInput.checked = true;
        }
        conformeLabel.appendChild(conformeInput);
        conformeLabel.appendChild(document.createTextNode(" Conforme"));
        checkboxesDiv.appendChild(conformeLabel);

        const naoConformeLabel = document.createElement("label");
        const naoConformeInput = document.createElement("input");
        naoConformeInput.type = "checkbox";
        naoConformeInput.name = key;
        naoConformeInput.value = "false";
        naoConformeInput.onchange = function () {
          marcarApenasUm(this);
        };
        if (inspecao[key] === false || inspecao[key] === 0) {
          naoConformeInput.checked = true;
        }
        naoConformeLabel.appendChild(naoConformeInput);
        naoConformeLabel.appendChild(document.createTextNode(" Não Conforme"));
        checkboxesDiv.appendChild(naoConformeLabel);

        checklistItem.appendChild(checkboxesDiv);
        checklistItemsContainer.appendChild(checklistItem);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar inspeção:", error); // Linha 190/191 original do erro
    alert("Erro ao carregar dados da inspeção: " + error.message);
    window.location.href = "/filtrar_veiculos";
  }
}

window.marcarApenasUm = function (checkbox) {
  const groupName = checkbox.name;
  const checkboxesInGroup = document.querySelectorAll(
    `input[type="checkbox"][name="${groupName}"]`
  );
  checkboxesInGroup.forEach((cb) => {
    if (cb !== checkbox) {
      cb.checked = false;
    }
  });
};

function validarFormulario(data) {
  if (!data.matricula) {
    exibirMensagem("Selecione uma matrícula!", "erro");
    return false;
  }
  if (!data.placa) {
    exibirMensagem("Selecione uma placa!", "erro");
    return false;
  }
  if (!data.data_inspecao) {
    exibirMensagem("Informe a data da inspeção!", "erro");
    return false;
  }
  const kmAtual = parseFloat(data.km_atual);
  if (isNaN(kmAtual) || kmAtual < 0) {
    exibirMensagem("Informe um valor válido para KM atual!", "erro");
    return false;
  }
  const horimetro = parseFloat(data.horimetro);
  if (isNaN(horimetro) || horimetro < 0) {
    exibirMensagem("Informe um valor válido para horímetro!", "erro");
    return false;
  }
  return true;
}

function exibirMensagem(mensagem, tipo = "sucesso") {
  const mensagemDiv = document.getElementById("mensagem");
  if (!mensagemDiv) return;
  mensagemDiv.textContent = mensagem;
  mensagemDiv.className = tipo;
  setTimeout(() => {
    mensagemDiv.textContent = "";
    mensagemDiv.className = "";
  }, 3000);
}

async function salvarAlteracoes(event) {
  event.preventDefault();

  const salvarButton = document.getElementById("salvarButton");
  const originalButtonText = salvarButton.textContent;
  salvarButton.disabled = true;
  salvarButton.textContent = "Salvando...";

  const form = document.getElementById("editarForm");
  const formData = new FormData(form);
  const data = {};

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("checklist_")) {
      data[key] = value;
    }
  }

  for (const itemName in mapeamentoNomes) {
    const checkboxes = document.querySelectorAll(
      `input[name="${itemName}"]:checked`
    );
    if (checkboxes.length > 0) {
      data[itemName] = checkboxes[0].value === "true";
    } else {
      data[itemName] = null;
    }
  }

  if (!validarFormulario(data)) {
    salvarButton.disabled = false;
    salvarButton.textContent = originalButtonText;
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  try {
    const response = await fetch(`/api/editar_inspecao/${id}`, {
      method: "POST", // << ALTERADO DE PUT PARA POST para corresponder ao backend
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok) {
      exibirMensagem(
        result.message || "Alterações salvas com sucesso!",
        "sucesso"
      );
      setTimeout(() => {
        window.location.href = "/filtrar_veiculos";
      }, 1500);
    } else {
      exibirMensagem(result.message || "Erro ao salvar alterações!", "erro");
      salvarButton.disabled = false;
      salvarButton.textContent = originalButtonText;
    }
  } catch (error) {
    console.error("Erro ao enviar dados:", error);
    exibirMensagem("Erro de comunicação ao salvar alterações!", "erro");
    salvarButton.disabled = false;
    salvarButton.textContent = originalButtonText;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  carregarMotoristas();
  carregarPlacas();
  carregarInspecao();

  const editarFormEl = document.getElementById("editarForm");
  if (editarFormEl) {
    editarFormEl.addEventListener("submit", salvarAlteracoes);
  }
});
