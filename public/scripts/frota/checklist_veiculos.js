// public/scripts/frota/checklist_veiculos.js

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

async function carregarMotoristas() {
  try {
    const response = await fetch("/api/motoristas");
    if (!response.ok) throw new Error("Erro ao carregar motoristas.");
    const data = await response.json();
    const select = document.getElementById("matricula");
    if (!select) return;

    select.innerHTML = '<option value="">Selecione a matrícula</option>';
    data.forEach((motorista) => {
      const option = document.createElement("option");
      option.value = motorista.matricula;
      option.textContent = `${motorista.matricula} - ${motorista.nome}`;
      select.appendChild(option);
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
    const select = document.getElementById("placa");
    if (!select) return;

    select.innerHTML = '<option value="">Selecione a placa</option>';
    data.forEach((veiculo) => {
      const option = document.createElement("option");
      option.value = veiculo.placa;
      option.textContent = veiculo.placa;
      select.appendChild(option);
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
    inputHidden.value = ""; // Inicializa como vazio (não selecionado)

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "checklist-options";

    const conformeBtn = document.createElement("button");
    conformeBtn.type = "button";
    conformeBtn.className = "option-btn conforme";
    conformeBtn.textContent = "Conforme";
    conformeBtn.addEventListener("click", () => {
      inputHidden.value = "1"; // Valor para 'Conforme'
      conformeBtn.classList.add("active");
      naoConformeBtn.classList.remove("active");
    });

    const naoConformeBtn = document.createElement("button");
    naoConformeBtn.type = "button";
    naoConformeBtn.className = "option-btn nao-conforme";
    naoConformeBtn.textContent = "Não Conforme";
    naoConformeBtn.addEventListener("click", () => {
      inputHidden.value = "0"; // Valor para 'Não Conforme'
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

async function salvarInspecao(event) {
  event.preventDefault();

  const botao = document.querySelector('#checklistForm button[type="submit"]');
  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  const form = document.getElementById("checklistForm");
  const formData = new FormData(form);
  const dados = {};

  for (const [chave, valor] of formData.entries()) {
    // Converte '1' para 1 (true) e '0' para 0 (false) para os itens do checklist
    // Mantém outros valores como estão (ex: datas, números, texto de observações)
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
      // Se um item do checklist não foi selecionado (nem conforme, nem não conforme)
      // o valor do input hidden será ''. Você pode querer tratar isso como null ou um valor padrão.
      dados[chave] = null; // Ou conforme sua API/banco espera
    } else {
      dados[chave] = valor.trim() === "" ? null : valor;
    }
  }

  // Validação básica
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
    return;
  }
  // Adiciona validação para que todos os itens do checklist tenham uma seleção
  let checklistCompleto = true;
  checklistItems.forEach((item) => {
    if (dados[item.id] === null || dados[item.id] === "") {
      // Verifica se está nulo ou string vazia
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
    return;
  }

  try {
    const response = await fetch("/api/salvar_inspecao", {
      // Assegure-se que esta API existe
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`, // Adiciona token se a API for protegida
      },
      body: JSON.stringify(dados),
    });

    const resultado = await response.json();

    if (response.ok) {
      exibirMensagem(
        resultado.message || "Inspeção salva com sucesso!",
        "sucesso"
      );
      form.reset(); // Limpa o formulário
      carregarItensChecklist(); // Recarrega os botões para o estado inicial
      // Redireciona para a página de frota ou filtrar inspeções
      setTimeout(() => (window.location.href = "/frota"), 2000);
    } else {
      throw new Error(resultado.message || "Erro ao salvar inspeção");
    }
  } catch (error) {
    console.error("Erro ao salvar inspeção:", error);
    exibirMensagem(error.message, "erro");
  } finally {
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  }
}

function exibirMensagem(texto, tipo = "sucesso") {
  const div = document.getElementById("mensagem");
  if (!div) return;
  div.textContent = texto;
  div.className = `mensagem ${tipo}`; // Adiciona a classe para estilização
  // Remove a mensagem após alguns segundos
  setTimeout(() => {
    div.textContent = "";
    div.className = "mensagem"; // Limpa a classe
  }, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  // O 'user' do localStorage não é usado diretamente neste script,
  // mas a proteção da rota no backend deve garantir que apenas usuários logados acessem.
  // Se precisar de dados do usuário aqui, pode obtê-los do localStorage.

  carregarMotoristas();
  carregarPlacas();
  carregarItensChecklist();

  const checklistFormEl = document.getElementById("checklistForm");
  if (checklistFormEl) {
    checklistFormEl.addEventListener("submit", salvarInspecao);
  }
});
