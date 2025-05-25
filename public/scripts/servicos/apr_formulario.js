document.addEventListener("DOMContentLoaded", async () => {
  const aprForm = document.getElementById("aprFormularioPrincipal");
  const infoServicoProcesso = document.getElementById("infoServicoProcesso");
  const infoServicoProcessoOriginalHidden = document.getElementById(
    "infoServicoProcessoOriginal"
  );
  const aprIdHidden = document.getElementById("aprIdHidden");
  const aprDataInput = document.getElementById("aprData");

  const turmaEncarregadoDisplay = document.getElementById(
    "turmaEncarregadoDisplay"
  );
  const turmaEncarregadoMatriculaHidden = document.getElementById(
    "turmaEncarregadoMatriculaHidden"
  );
  const responsavelAprDisplay = document.getElementById(
    "responsavelAprDisplay"
  );
  const responsavelAprMatriculaHidden = document.getElementById(
    "responsavelAprMatriculaHidden"
  );

  const btnEditarAPR = document.getElementById("btnEditarAPR");
  const btnSalvarAPR = document.getElementById("btnSalvarAPR");

  let modalEncarregadoTurmaInstance,
    modalResponsavelAPRInstance,
    modalParticipantesTurmaInstance,
    modalAtividadeAPRInstance,
    modalMaterialAPRInstance;
  let listaCompletaEncarregados = [];
  let listaCompletaResponsaveisAPR = [];
  let listaCompletaTurmasParaParticipantes = [];
  let listaCompletaFuncionariosDaTurma = [];
  let listaCompletaServicosAPR = [];
  let listaCompletaMateriaisAPR = [];
  let matriculaEncarregadoParaParticipantes = null;

  const urlParams = new URLSearchParams(window.location.search);
  const servicoId = urlParams.get("servicoId");
  const isPrintMode = urlParams.get("printMode") === "true";
  const isViewModeInitially = urlParams.get("mode") === "view" && !isPrintMode;
  let isEditingEnabled = !isViewModeInitially && !isPrintMode;

  if (!servicoId) {
    alert("ID do Serviço não fornecido na URL.");
    if (!isPrintMode) window.location.href = "/servicos_ativos";
    return;
  }

  const definicoesAPR = {
    perguntasARC: [
      {
        chave: "arc_informados",
        texto:
          "Todos os componentes da equipe estão informados sobre o serviço a ser realizado?",
      },
      {
        chave: "arc_capacitados",
        texto:
          "Todos os componentes da equipe estão capacitados para realizar a tarefa?",
      },
      {
        chave: "arc_bem_fisica_mental",
        texto: "Todos os componentes da turma estão bem física e mentalmente?",
      },
      {
        chave: "arc_participaram_planejamento",
        texto:
          "Todos os componentes da turma participaram do planejamento e avaliação do serviço?",
      },
      {
        chave: "arc_possui_epis",
        texto:
          "Todos os componentes da equipe possuem os EPIs para a execução do serviço?",
      },
      {
        chave: "arc_epis_condicoes",
        texto: "Os EPIs estão em perfeitas condições de uso?",
      },
      {
        chave: "arc_possui_epcs",
        texto: "A equipe possui os EPCs para a realização do serviço?",
      },
      {
        chave: "arc_epcs_condicoes",
        texto: "Os EPCs estão em perfeitas condições de uso?",
      },
      {
        chave: "arc_autorizacao_cod",
        texto: "O serviço requer autorização do COD?",
      },
      {
        chave: "arc_comunicacao_cod",
        texto: "A equipe possui meio de comunicação fluente com o COD?",
      },
      {
        chave: "arc_viatura_condicoes",
        texto: "A viatura está em boas condições de uso?",
      },
      {
        chave: "arc_sinalizacao_area",
        texto:
          "O serviço requer a sinalização e isolamento da área de trabalho?",
      },
      {
        chave: "arc_desligamento_equipamentos",
        texto: "O serviço requer o desligamento e/ou bloqueio de equipamentos?",
      },
      {
        chave: "arc_teste_tensao",
        texto: "O serviço requer teste de ausência de tensão?",
      },
      {
        chave: "arc_aterramento_temporario",
        texto: "O serviço requer uso de aterramento temporário?",
      },
      {
        chave: "arc_teste_pontalete",
        texto: "O serviço requer teste de pontalete?",
      },
      {
        chave: "arc_iluminacao_auxiliar",
        texto: "O serviço requer o uso de iluminação auxiliar (refletor)?",
      },
      { chave: "arc_uso_escadas", texto: "O serviço requer o uso de escadas?" },
    ],
    riscosEspecificos: [
      { chave: "risco_queda", texto: "Queda" },
      { chave: "risco_ruidos", texto: "Rudos" },
      { chave: "risco_explosao", texto: "Exploso" },
      { chave: "risco_chuva", texto: "Chuva" },
      { chave: "risco_arco_voltaico", texto: "Arco voltaico" },
      { chave: "risco_choque_eletrico", texto: "Choque eltrico" },
      { chave: "risco_cruzamento_circuitos", texto: "Cruzamento de circuitos" },
      { chave: "risco_projecao_objetos", texto: "Projeo/ impacto de objetos" },
      { chave: "risco_animais_peconhentos", texto: "Animais peonhentos" },
      { chave: "risco_atropelamento", texto: "Atropelamento" },
      { chave: "risco_dificil_posicionamento", texto: "Difcil posicionamento" },
    ],
    medidasControle: [
      {
        chave: "medida_delimitar_sinalizar",
        texto:
          "Delimitar e sinalizar a área de trabalho com cones, fitas ou correntes de isolamento e placas",
      },
      {
        chave: "medida_cuidado_sky",
        texto:
          "Ao subir e descer do sky, tenha o cuidado e retire as sucatas que podem estar no caminho",
      },
      {
        chave: "medida_escada_apoiada",
        texto:
          "Ao subir e descer da escada tenha certeza de que a mesma está apoiada e bem amarrada",
      },
      {
        chave: "medida_cinto_paraquedista",
        texto:
          "Dois da equipe devem utilizar o cinto paraquedista ao realizar serviços no Sky ou na escada",
      },
      {
        chave: "medida_subir_descer_atencao",
        texto:
          "Subir e descer do sky ou escada com atenção e firmeza utilizando os EPIs necessários",
      },
      {
        chave: "medida_posicionar_cesto",
        texto:
          "Posicionar-se sobre o cesto para executar as manobras, não inclinar-se demais para fora dele",
      },
      {
        chave: "medida_cobrir_condutores_terra",
        texto:
          "Quando o eletricista estiver entre os condutores, cobrir os condutores e o terra",
      },
      {
        chave: "medida_evitar_forcar_coberturas",
        texto:
          "Ao colocar as coberturas nos condutores, evitar forçá-los ou balançá-los",
      },
      {
        chave: "medida_verificar_condicoes_postes",
        texto:
          "No momento em que estiver tensionando o condutor ou fazendo emendas, verificar as condies dos poste, o esforo mecnico e as estruturas adjacentes",
      },
      {
        chave: "medida_utilizar_epi_epc_adequados",
        texto: "Utilizar os EPIs e EPCs de maneira adequada",
      },
      {
        chave: "medida_aterrar_veiculo",
        texto: "Aterrar devidamente o veículo",
      },
    ],
  };

  function setFormEditable(isEditable) {
    const formElements = aprForm.elements;
    for (let i = 0; i < formElements.length; i++) {
      const element = formElements[i];
      const tagName = element.tagName.toLowerCase();
      if (
        element.type !== "hidden" &&
        element.id !== "btnSalvarAPR" &&
        element.id !== "btnEditarAPR"
      ) {
        if (
          tagName === "input" ||
          tagName === "textarea" ||
          tagName === "select"
        ) {
          element.readOnly = !isEditable;
          element.disabled = !isEditable;
        }
        if (
          element.type === "button" &&
          !element.classList.contains("btn-remover-linha") &&
          !element.classList.contains("btn-remover-participante-display") &&
          !element.classList.contains("btn-remover-linha-atividade") &&
          !element.classList.contains("btn-remover-linha-material")
        ) {
          element.disabled = !isEditable;
        }
      }
    }
    document
      .querySelectorAll(
        ".btn-remover-linha, .btn-remover-participante-display, .btn-remover-linha-atividade, .btn-remover-linha-material, #btnAbrirModalSelecionarParticipantes, #btnAdicionarAtividadeAPR, #btnAdicionarMaterialAPR, #btnSelecionarEncarregadoTurma, #btnSelecionarResponsavelAPR"
      )
      .forEach((btn) => {
        if (btn) {
          btn.style.display = isEditable ? "inline-block" : "none";
          if (btn.tagName === "BUTTON") btn.disabled = !isEditable;
        }
      });

    if (btnSalvarAPR)
      btnSalvarAPR.style.display = isEditable ? "block" : "none";
    if (btnEditarAPR) {
      if (isViewModeInitially && !isEditable) {
        btnEditarAPR.style.display = "inline-block";
      } else {
        btnEditarAPR.style.display = "none";
      }
    }
  }

  function popularChecklistsEPerguntas() {
    const perguntasContainer = document.getElementById("arcPerguntasContainer");
    if (perguntasContainer) {
      definicoesAPR.perguntasARC.forEach((pergunta) => {
        const div = document.createElement("div");
        div.className = "mb-3 p-2 border rounded";
        div.innerHTML = `
                    <p class="mb-1"><strong>${pergunta.texto}</strong></p>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${pergunta.chave}" id="${pergunta.chave}_sim" value="sim" required>
                        <label class="form-check-label" for="${pergunta.chave}_sim">Sim</label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${pergunta.chave}" id="${pergunta.chave}_nao" value="nao">
                        <label class="form-check-label" for="${pergunta.chave}_nao">Não</label>
                    </div>
                    <div class="form-check form-check-inline">
                        <input class="form-check-input" type="radio" name="${pergunta.chave}" id="${pergunta.chave}_na" value="na">
                        <label class="form-check-label" for="${pergunta.chave}_na">NA</label>
                    </div>
                `;
        perguntasContainer.appendChild(div);
      });
    }

    const riscosContainer = document.getElementById(
      "arcRiscosEspecificosContainer"
    );
    if (riscosContainer) {
      definicoesAPR.riscosEspecificos.forEach((risco) => {
        const div = document.createElement("div");
        div.className = "form-check";
        div.innerHTML = `
                    <input class="form-check-input" type="checkbox" name="${risco.chave}" id="${risco.chave}" value="true">
                    <label class="form-check-label" for="${risco.chave}">${risco.texto}</label>
                `;
        riscosContainer.appendChild(div);
      });
      riscosContainer.innerHTML += `<div class="form-check"><input class="form-check-input" type="checkbox" name="risco_outros_check" id="risco_outros_check"><label class="form-check-label" for="risco_outros_check">Outros:</label><input type="text" class="form-control form-control-sm d-inline-block ms-2" style="width:auto;" name="riscos_especificos_texto" id="riscos_especificos_texto" placeholder="Especifique"></div>`;
    }

    const medidasContainer = document.getElementById(
      "aprMedidasControleContainer"
    );
    if (medidasContainer) {
      definicoesAPR.medidasControle.forEach((medida) => {
        const div = document.createElement("div");
        div.className = "form-check";
        div.innerHTML = `
                    <input class="form-check-input" type="checkbox" name="${medida.chave}" id="${medida.chave}" value="true">
                    <label class="form-check-label" for="${medida.chave}">${medida.texto}</label>
                `;
        medidasContainer.appendChild(div);
      });
    }
  }

  async function carregarInfoServico() {
    try {
      const response = await fetch(`/api/servicos/${servicoId}`);
      if (!response.ok)
        throw new Error("Falha ao buscar informações do serviço.");
      const res = await response.json();
      if (res.success && res.data) {
        if (infoServicoProcesso)
          infoServicoProcesso.textContent = res.data.processo || "N/A";
        if (infoServicoProcessoOriginalHidden && res.data.processo)
          infoServicoProcessoOriginalHidden.value = res.data.processo;

        const infoServicoTipo = document.getElementById("infoServicoTipo");
        if (infoServicoTipo)
          infoServicoTipo.textContent = res.data.tipo || "N/A";
        const infoServicoDataPrevista = document.getElementById(
          "infoServicoDataPrevista"
        );
        if (infoServicoDataPrevista)
          infoServicoDataPrevista.textContent = res.data.data_prevista_execucao
            ? new Date(res.data.data_prevista_execucao).toLocaleDateString(
                "pt-BR",
                { timeZone: "UTC" }
              )
            : "N/A";
        const infoServicoSubestacao = document.getElementById(
          "infoServicoSubestacao"
        );
        if (infoServicoSubestacao)
          infoServicoSubestacao.textContent = res.data.subestacao || "N/A";

        if (document.getElementById("alimentadorAPR") && res.data.alimentador)
          document.getElementById("alimentadorAPR").value =
            res.data.alimentador;
        if (document.getElementById("subestacaoAPR") && res.data.subestacao)
          document.getElementById("subestacaoAPR").value = res.data.subestacao;
        if (
          document.getElementById("chaveMontanteAPR") &&
          res.data.chave_montante
        )
          document.getElementById("chaveMontanteAPR").value =
            res.data.chave_montante;
        if (document.getElementById("aprLocalRealServico") && res.data.maps)
          document.getElementById(
            "aprLocalRealServico"
          ).value = `Coordenadas/Link: ${res.data.maps}`;
      }
    } catch (error) {
      console.error("Erro ao carregar informações do serviço:", error);
      const infoServicoCard = document.getElementById("infoServicoCard");
      if (infoServicoCard)
        infoServicoCard.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
  }

  async function carregarAPRExistente() {
    try {
      const response = await fetch(`/api/servicos/${servicoId}/apr-dados`);
      const res = await response.json();

      if (res.success && res.data) {
        if (aprIdHidden) aprIdHidden.value = res.data.id;
        const dados = res.data;

        for (const key in dados) {
          if (dados.hasOwnProperty(key)) {
            const elements = aprForm.elements[key];
            if (elements) {
              if (
                typeof elements.length !== "undefined" &&
                elements.type !== "select-one" &&
                elements[0] &&
                elements[0].type === "radio"
              ) {
                Array.from(elements).forEach((radio) => {
                  if (radio.value === dados[key]) {
                    radio.checked = true;
                  }
                });
              } else if (elements.type === "checkbox") {
                elements.checked =
                  dados[key] === true ||
                  dados[key] === "true" ||
                  dados[key] === 1 ||
                  (typeof dados[key] === "string" &&
                    dados[key].toLowerCase() === elements.value.toLowerCase());
              } else if (elements.type === "date" && dados[key]) {
                const datePart = String(dados[key]).split("T")[0];
                elements.value = datePart;
              } else if (elements.type === "time" && dados[key]) {
                elements.value = String(dados[key]).substring(0, 5);
              } else {
                elements.value = dados[key];
              }
            }
          }
        }

        if (dados.turma_encarregado_matricula && turmaEncarregadoDisplay) {
          const encarregado = listaCompletaEncarregados.find(
            (u) => u.matricula === dados.turma_encarregado_matricula
          );
          turmaEncarregadoDisplay.value = encarregado
            ? `${encarregado.matricula} - ${encarregado.nome}`
            : dados.turma_encarregado_matricula;
          if (turmaEncarregadoMatriculaHidden)
            turmaEncarregadoMatriculaHidden.value =
              dados.turma_encarregado_matricula;
        }
        if (dados.responsavel_apr_matricula && responsavelAprDisplay) {
          const responsavel = listaCompletaResponsaveisAPR.find(
            (u) => u.matricula === dados.responsavel_apr_matricula
          );
          responsavelAprDisplay.value = responsavel
            ? `${responsavel.matricula} - ${responsavel.nome}`
            : dados.responsavel_apr_matricula;
          if (responsavelAprMatriculaHidden)
            responsavelAprMatriculaHidden.value =
              dados.responsavel_apr_matricula;
        }

        if (dados.parada_motivos) {
          const motivos = dados.parada_motivos.split(",").map((m) => m.trim());
          document
            .querySelectorAll('input[name="apr_motivo_parada"]')
            .forEach((chk) => (chk.checked = false));
          motivos.forEach((motivo) => {
            if (motivo.startsWith("Outros:")) {
              const outrosCheck = document.getElementById("motivoOutrosCheck");
              const outrosText = document.getElementById("motivoOutrosText");
              if (outrosCheck) outrosCheck.checked = true;
              if (outrosText)
                outrosText.value = motivo.replace("Outros:", "").trim();
            } else {
              const check = document.querySelector(
                `input[name="apr_motivo_parada"][value="${motivo}"]`
              );
              if (check) check.checked = true;
            }
          });
        }

        if (dados.riscos_especificos_texto || dados.risco_outros_check) {
          const outrosCheck = document.getElementById("risco_outros_check");
          const riscosEspecificosTextoInput = document.getElementById(
            "riscos_especificos_texto"
          );
          if (outrosCheck)
            outrosCheck.checked =
              !!dados.risco_outros_check || !!dados.riscos_especificos_texto;
          if (riscosEspecificosTextoInput && dados.riscos_especificos_texto)
            riscosEspecificosTextoInput.value = dados.riscos_especificos_texto;
        }

        document
          .querySelectorAll("#aprEmpregadosLista .row-participante")
          .forEach((row) => row.remove());
        if (
          dados.apr_empregados_lista &&
          Array.isArray(dados.apr_empregados_lista)
        ) {
          dados.apr_empregados_lista.forEach((emp) =>
            adicionarLinhaEmpregadoDisplay({
              matricula: emp.empregado_matricula,
              nome: emp.empregado_nome,
            })
          );
        }

        if (
          dados.apr_medidas_controle_selecionadas &&
          Array.isArray(dados.apr_medidas_controle_selecionadas)
        ) {
          dados.apr_medidas_controle_selecionadas.forEach((medidaChave) => {
            const check = aprForm.elements[medidaChave];
            if (check && check.type === "checkbox") check.checked = true;
          });
        }

        document
          .querySelectorAll("#aprAtividadesRealizadasLista .row-atividade")
          .forEach((row) => row.remove());
        atividadeIdx = 0;
        if (
          dados.apr_atividades_executadas_lista &&
          Array.isArray(dados.apr_atividades_executadas_lista)
        ) {
          dados.apr_atividades_executadas_lista.forEach((atv) =>
            adicionarLinhaAtividadeDisplay(atv)
          );
        }

        document
          .querySelectorAll("#aprMateriaisGastosLista .row-material")
          .forEach((row) => row.remove());
        materialIdx = 0;
        if (
          dados.apr_materiais_utilizados_lista &&
          Array.isArray(dados.apr_materiais_utilizados_lista)
        ) {
          dados.apr_materiais_utilizados_lista.forEach((mat) =>
            adicionarLinhaMaterialDisplay(mat)
          );
        }
      } else {
        if (aprDataInput) aprDataInput.valueAsDate = new Date();
      }
    } catch (error) {
      console.warn(
        "Nenhuma APR preenchida encontrada ou erro ao carregar:",
        error
      );
      if (aprDataInput) aprDataInput.valueAsDate = new Date();
    }
  }

  const empregadosListaDiv = document.getElementById("aprEmpregadosLista");

  function adicionarLinhaEmpregadoDisplay(
    empregado = { matricula: "", nome: "" }
  ) {
    if (!empregado.matricula && !empregado.nome) return;
    const div = document.createElement("div");
    div.className = "row mb-2 align-items-center row-participante";
    div.dataset.matricula = empregado.matricula;
    div.innerHTML = `
            <div class="col-5">
                <span class="selected-item-display">${
                  empregado.matricula || "N/A"
                }</span>
            </div>
            <div class="col-6">
                <span class="selected-item-display">${
                  empregado.nome || "N/A"
                }</span>
            </div>
            <div class="col-1">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-participante-display"><i class="fas fa-times"></i></button>
            </div>
        `;
    if (empregadosListaDiv) empregadosListaDiv.appendChild(div);
    const btnRemover = div.querySelector(".btn-remover-participante-display");
    if (btnRemover && !isPrintMode) {
      btnRemover.addEventListener("click", () => div.remove());
      if (!isEditingEnabled) btnRemover.style.display = "none";
    } else if (btnRemover) {
      btnRemover.style.display = "none";
    }
  }

  const atividadesListaDiv = document.getElementById(
    "aprAtividadesRealizadasLista"
  );
  let atividadeIdx = 0;

  function adicionarLinhaAtividadeDisplay(
    atividade = { codigo_bd: "", descricao: "", quantidade: "", unidade: "" }
  ) {
    atividadeIdx++;
    const div = document.createElement("div");
    div.className = "row mb-2 align-items-center row-atividade";
    div.innerHTML = `
            <div class="col-md-3">
                <input type="text" class="form-control form-control-sm" name="atividade_codigo_${atividadeIdx}" placeholder="Cód. Atividade" value="${
      atividade.codigo_bd || ""
    }" readonly>
            </div>
            <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" name="atividade_descricao_${atividadeIdx}" placeholder="Descrição da Atividade" value="${
      atividade.descricao || ""
    }" required>
            </div>
            <div class="col-md-2">
                <input type="number" step="any" class="form-control form-control-sm" name="atividade_quantidade_${atividadeIdx}" placeholder="Qtd" value="${
      atividade.quantidade || ""
    }">
            </div>
             <div class="col-md-2">
                <input type="text" class="form-control form-control-sm" name="atividade_unidade_${atividadeIdx}" placeholder="Und" value="${
      atividade.unidade || ""
    }" readonly>
            </div>
            <div class="col-md-1">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-linha-atividade"><i class="fas fa-times"></i></button>
            </div>
        `;
    if (atividadesListaDiv) atividadesListaDiv.appendChild(div);
    const btnRemover = div.querySelector(".btn-remover-linha-atividade");
    if (btnRemover && !isPrintMode) {
      btnRemover.addEventListener("click", () => div.remove());
      if (!isEditingEnabled) btnRemover.style.display = "none";
    } else if (btnRemover) {
      btnRemover.style.display = "none";
    }
  }

  const materiaisListaDiv = document.getElementById("aprMateriaisGastosLista");
  let materialIdx = 0;

  function adicionarLinhaMaterialDisplay(
    material = { codigo_bd: "", quantidade: "", descricao: "" }
  ) {
    materialIdx++;
    const div = document.createElement("div");
    div.className = "row mb-2 align-items-center row-material";
    div.innerHTML = `
            <div class="col-3">
                <input type="text" class="form-control form-control-sm" name="material_codigo_${materialIdx}" placeholder="Cód. Material" value="${
      material.codigo_bd || ""
    }" readonly>
            </div>
            <div class="col-2">
                <input type="number" step="any" class="form-control form-control-sm" name="material_quantidade_${materialIdx}" placeholder="Qtd" value="${
      material.quantidade || ""
    }">
            </div>
            <div class="col-6">
                <input type="text" class="form-control form-control-sm" name="material_descricao_${materialIdx}" placeholder="Descrição do Material" value="${
      material.descricao || ""
    }" required>
            </div>
            <div class="col-1">
                <button type="button" class="btn btn-sm btn-outline-danger btn-remover-linha-material"><i class="fas fa-times"></i></button>
            </div>
        `;
    if (materiaisListaDiv) materiaisListaDiv.appendChild(div);
    const btnRemover = div.querySelector(".btn-remover-linha-material");
    if (btnRemover && !isPrintMode) {
      btnRemover.addEventListener("click", () => div.remove());
      if (!isEditingEnabled) btnRemover.style.display = "none";
    } else if (btnRemover) {
      btnRemover.style.display = "none";
    }
  }

  async function carregarDadosModalEncarregados() {
    if (isPrintMode) return;
    try {
      const response = await fetch("/api/encarregados-turma");
      if (!response.ok) throw new Error("Falha ao carregar encarregados");
      listaCompletaEncarregados = await response.json();
      renderizarListaModal(
        listaCompletaEncarregados,
        "listaModalEncarregadosTurma",
        selecionarEncarregadoTurma
      );
      listaCompletaTurmasParaParticipantes = listaCompletaEncarregados;
      renderizarListaModal(
        listaCompletaTurmasParaParticipantes,
        "listaModalTurmasParaParticipantes",
        selecionarTurmaParaParticipantes
      );
    } catch (error) {
      console.error("Erro ao carregar encarregados para modal:", error);
    }
  }

  async function carregarDadosModalResponsaveisAPR() {
    if (isPrintMode) return;
    try {
      const response = await fetch("/api/usuarios-para-responsavel-apr");
      if (!response.ok) throw new Error("Falha ao carregar responsáveis APR");
      listaCompletaResponsaveisAPR = await response.json();
      renderizarListaModal(
        listaCompletaResponsaveisAPR,
        "listaModalResponsaveisAPR",
        selecionarResponsavelAPR
      );
    } catch (error) {
      console.error("Erro ao carregar responsáveis APR para modal:", error);
    }
  }

  async function carregarFuncionariosDaTurma(matriculaEnc) {
    if (isPrintMode) return;
    const listaFuncionariosDiv = document.getElementById(
      "listaModalFuncionariosDaTurma"
    );
    if (!listaFuncionariosDiv) return;
    listaFuncionariosDiv.innerHTML =
      '<div class="text-center p-2"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Carregando...</span></div></div>';
    try {
      const response = await fetch(`/api/turmas/${matriculaEnc}/funcionarios`);
      if (!response.ok)
        throw new Error("Falha ao carregar funcionários da turma");
      listaCompletaFuncionariosDaTurma = await response.json();
      renderizarListaFuncionariosDaTurma(listaCompletaFuncionariosDaTurma, "");
    } catch (error) {
      console.error("Erro ao carregar funcionários da turma:", error);
      listaFuncionariosDiv.innerHTML =
        '<p class="text-danger p-2">Erro ao carregar funcionários.</p>';
    }
  }

  function renderizarListaFuncionariosDaTurma(items, filtro = "") {
    const listaElement = document.getElementById(
      "listaModalFuncionariosDaTurma"
    );
    if (!listaElement) return;
    listaElement.innerHTML = "";
    const termoFiltro = filtro.toLowerCase();
    const itemsFiltrados = items.filter(
      (item) =>
        item.nome.toLowerCase().includes(termoFiltro) ||
        item.matricula.toLowerCase().includes(termoFiltro)
    );

    if (itemsFiltrados.length === 0) {
      listaElement.innerHTML =
        '<p class="text-muted p-2">Nenhum funcionário encontrado.</p>';
      return;
    }
    itemsFiltrados.forEach((item) => {
      const div = document.createElement("div");
      div.className = "form-check";
      div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${item.matricula}" id="func_${item.matricula}" data-nome="${item.nome}">
                <label class="form-check-label" for="func_${item.matricula}">
                    ${item.matricula} - ${item.nome} (${item.cargo})
                </label>
            `;
      listaElement.appendChild(div);
    });
  }

  async function carregarServicosAPRModal() {
    if (isPrintMode) return;
    try {
      const response = await fetch("/api/apr-lista-servicos");
      if (!response.ok)
        throw new Error("Falha ao carregar lista de serviços APR");
      listaCompletaServicosAPR = await response.json();
      renderizarListaModalSelecaoUnica(
        listaCompletaServicosAPR,
        "listaModalAtividadesAPR",
        selecionarAtividadeAPR,
        ["COD", "descricao"]
      );
    } catch (error) {
      console.error("Erro ao carregar serviços APR:", error);
    }
  }
  async function carregarMateriaisAPRModal() {
    if (isPrintMode) return;
    try {
      const response = await fetch("/api/apr-lista-materiais");
      if (!response.ok)
        throw new Error("Falha ao carregar lista de materiais APR");
      listaCompletaMateriaisAPR = await response.json();
      renderizarListaModalSelecaoUnica(
        listaCompletaMateriaisAPR,
        "listaModalMateriaisAPR",
        selecionarMaterialAPR,
        ["COD", "descricao"]
      );
    } catch (error) {
      console.error("Erro ao carregar materiais APR:", error);
    }
  }

  function renderizarListaModal(
    items,
    listElementId,
    callbackSelecao,
    filtro = ""
  ) {
    const listaElement = document.getElementById(listElementId);
    if (!listaElement) return;
    listaElement.innerHTML = "";
    const termoFiltro = filtro.toLowerCase();
    const itemsFiltrados = items.filter(
      (item) =>
        item.nome.toLowerCase().includes(termoFiltro) ||
        (item.matricula && item.matricula.toLowerCase().includes(termoFiltro))
    );

    if (itemsFiltrados.length === 0) {
      listaElement.innerHTML =
        '<p class="text-muted p-2">Nenhum item encontrado.</p>';
      return;
    }
    itemsFiltrados.forEach((item) => {
      const a = document.createElement("a");
      a.href = "#";
      a.className = "list-group-item list-group-item-action";
      a.textContent = `${item.matricula} - ${item.nome}`;
      a.dataset.matricula = item.matricula;
      a.dataset.nome = item.nome;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        callbackSelecao(item.matricula, item.nome, item);
      });
      listaElement.appendChild(a);
    });
  }

  function renderizarListaModalSelecaoUnica(
    items,
    listElementId,
    callbackSelecao,
    camposBusca = ["COD", "descricao"],
    filtro = ""
  ) {
    const listaElement = document.getElementById(listElementId);
    if (!listaElement) return;
    listaElement.innerHTML = "";
    const termoFiltro = filtro.toLowerCase();

    const itemsFiltrados = items.filter((item) => {
      return camposBusca.some(
        (campo) =>
          item[campo] && String(item[campo]).toLowerCase().includes(termoFiltro)
      );
    });

    if (itemsFiltrados.length === 0) {
      listaElement.innerHTML =
        '<p class="text-muted p-2">Nenhum item encontrado.</p>';
      return;
    }
    itemsFiltrados.forEach((item) => {
      const a = document.createElement("a");
      a.href = "#";
      a.className = "list-group-item list-group-item-action";
      a.textContent = `${item.COD} - ${item.descricao}`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        callbackSelecao(item);
      });
      listaElement.appendChild(a);
    });
  }

  function selecionarEncarregadoTurma(matricula, nome) {
    if (turmaEncarregadoDisplay)
      turmaEncarregadoDisplay.value = `${matricula} - ${nome}`;
    if (turmaEncarregadoMatriculaHidden)
      turmaEncarregadoMatriculaHidden.value = matricula;
    if (modalEncarregadoTurmaInstance) modalEncarregadoTurmaInstance.hide();
  }

  function selecionarResponsavelAPR(matricula, nome) {
    if (responsavelAprDisplay)
      responsavelAprDisplay.value = `${matricula} - ${nome}`;
    if (responsavelAprMatriculaHidden)
      responsavelAprMatriculaHidden.value = matricula;
    if (modalResponsavelAPRInstance) modalResponsavelAPRInstance.hide();
  }

  function selecionarTurmaParaParticipantes(matricula, nome) {
    matriculaEncarregadoParaParticipantes = matricula;
    const nomeTurmaSpan = document.getElementById(
      "nomeTurmaSelecionadaParaParticipantes"
    );
    if (nomeTurmaSpan)
      nomeTurmaSpan.textContent = `Turma de ${nome} (${matricula})`;
    carregarFuncionariosDaTurma(matricula);
  }

  function selecionarAtividadeAPR(item) {
    adicionarLinhaAtividadeDisplay({
      codigo_bd: item.COD,
      descricao: item.descricao,
      unidade: item.UND,
      quantidade: 1,
    });
    if (modalAtividadeAPRInstance) modalAtividadeAPRInstance.hide();
  }
  function selecionarMaterialAPR(item) {
    adicionarLinhaMaterialDisplay({
      codigo_bd: item.COD,
      descricao: item.descricao,
      quantidade: 1,
    });
    if (modalMaterialAPRInstance) modalMaterialAPRInstance.hide();
  }

  const filtroModalEncarregadoTurma = document.getElementById(
    "filtroModalEncarregadoTurma"
  );
  if (filtroModalEncarregadoTurma)
    filtroModalEncarregadoTurma.addEventListener("input", (e) => {
      renderizarListaModal(
        listaCompletaEncarregados,
        "listaModalEncarregadosTurma",
        selecionarEncarregadoTurma,
        e.target.value
      );
    });

  const filtroModalResponsavelAPR = document.getElementById(
    "filtroModalResponsavelAPR"
  );
  if (filtroModalResponsavelAPR)
    filtroModalResponsavelAPR.addEventListener("input", (e) => {
      renderizarListaModal(
        listaCompletaResponsaveisAPR,
        "listaModalResponsaveisAPR",
        selecionarResponsavelAPR,
        e.target.value
      );
    });

  const filtroModalTurmaParaParticipantes = document.getElementById(
    "filtroModalTurmaParaParticipantes"
  );
  if (filtroModalTurmaParaParticipantes)
    filtroModalTurmaParaParticipantes.addEventListener("input", (e) => {
      renderizarListaModal(
        listaCompletaTurmasParaParticipantes,
        "listaModalTurmasParaParticipantes",
        selecionarTurmaParaParticipantes,
        e.target.value
      );
    });

  const filtroModalFuncionariosDaTurma = document.getElementById(
    "filtroModalFuncionariosDaTurma"
  );
  if (filtroModalFuncionariosDaTurma)
    filtroModalFuncionariosDaTurma.addEventListener("input", (e) => {
      renderizarListaFuncionariosDaTurma(
        listaCompletaFuncionariosDaTurma,
        e.target.value
      );
    });

  const filtroModalAtividadeAPR = document.getElementById(
    "filtroModalAtividadeAPR"
  );
  if (filtroModalAtividadeAPR)
    filtroModalAtividadeAPR.addEventListener("input", (e) => {
      renderizarListaModalSelecaoUnica(
        listaCompletaServicosAPR,
        "listaModalAtividadesAPR",
        selecionarAtividadeAPR,
        ["COD", "descricao"],
        e.target.value
      );
    });

  const filtroModalMaterialAPR = document.getElementById(
    "filtroModalMaterialAPR"
  );
  if (filtroModalMaterialAPR)
    filtroModalMaterialAPR.addEventListener("input", (e) => {
      renderizarListaModalSelecaoUnica(
        listaCompletaMateriaisAPR,
        "listaModalMateriaisAPR",
        selecionarMaterialAPR,
        ["COD", "descricao"],
        e.target.value
      );
    });

  const btnAbrirModalParticipantes = document.getElementById(
    "btnAbrirModalSelecionarParticipantes"
  );
  if (btnAbrirModalParticipantes) {
    btnAbrirModalParticipantes.addEventListener("click", () => {
      if (
        listaCompletaTurmasParaParticipantes.length === 0 &&
        listaCompletaEncarregados.length > 0
      ) {
        listaCompletaTurmasParaParticipantes = listaCompletaEncarregados;
        renderizarListaModal(
          listaCompletaTurmasParaParticipantes,
          "listaModalTurmasParaParticipantes",
          selecionarTurmaParaParticipantes
        );
      } else if (
        listaCompletaTurmasParaParticipantes.length === 0 &&
        listaCompletaEncarregados.length === 0
      ) {
        carregarDadosModalEncarregados().then(() => {
          listaCompletaTurmasParaParticipantes = listaCompletaEncarregados;
          renderizarListaModal(
            listaCompletaTurmasParaParticipantes,
            "listaModalTurmasParaParticipantes",
            selecionarTurmaParaParticipantes
          );
        });
      }
      const listaFuncionariosDiv = document.getElementById(
        "listaModalFuncionariosDaTurma"
      );
      if (listaFuncionariosDiv)
        listaFuncionariosDiv.innerHTML =
          '<p class="text-muted p-2">Selecione uma turma primeiro.</p>';
      const nomeTurmaSpan = document.getElementById(
        "nomeTurmaSelecionadaParaParticipantes"
      );
      if (nomeTurmaSpan)
        nomeTurmaSpan.textContent = "Nenhuma turma selecionada";
      matriculaEncarregadoParaParticipantes = null;
      if (modalParticipantesTurmaInstance)
        modalParticipantesTurmaInstance.show();
    });
  }

  const btnConfirmarAdicionarParticipantes = document.getElementById(
    "btnConfirmarAdicionarParticipantes"
  );
  if (btnConfirmarAdicionarParticipantes) {
    btnConfirmarAdicionarParticipantes.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(
        '#listaModalFuncionariosDaTurma input[type="checkbox"]:checked'
      );
      checkboxes.forEach((cb) => {
        const matricula = cb.value;
        const nome = cb.dataset.nome;
        const jaAdicionado = document.querySelector(
          `#aprEmpregadosLista .row-participante[data-matricula="${matricula}"]`
        );
        if (!jaAdicionado) {
          adicionarLinhaEmpregadoDisplay({ matricula, nome });
        }
      });
      if (modalParticipantesTurmaInstance)
        modalParticipantesTurmaInstance.hide();
    });
  }

  if (typeof bootstrap !== "undefined") {
    const modalEncarregadoEl = document.getElementById(
      "modalSelecionarEncarregadoTurma"
    );
    if (modalEncarregadoEl)
      modalEncarregadoTurmaInstance = new bootstrap.Modal(modalEncarregadoEl);

    const modalResponsavelAPREl = document.getElementById(
      "modalSelecionarResponsavelAPR"
    );
    if (modalResponsavelAPREl)
      modalResponsavelAPRInstance = new bootstrap.Modal(modalResponsavelAPREl);

    const modalParticipantesEl = document.getElementById(
      "modalSelecionarParticipantesTurma"
    );
    if (modalParticipantesEl)
      modalParticipantesTurmaInstance = new bootstrap.Modal(
        modalParticipantesEl
      );

    const modalAtividadeEl = document.getElementById(
      "modalSelecionarAtividadeAPR"
    );
    if (modalAtividadeEl)
      modalAtividadeAPRInstance = new bootstrap.Modal(modalAtividadeEl);

    const modalMaterialEl = document.getElementById(
      "modalSelecionarMaterialAPR"
    );
    if (modalMaterialEl)
      modalMaterialAPRInstance = new bootstrap.Modal(modalMaterialEl);
  }

  function preparePageForPrinting() {
    console.log("Client: Preparing page for printing...");
    document
      .querySelectorAll(
        "button, .btn, .sidebar, .sidebar-toggle-button, .main-content > .container > .d-flex.justify-content-between a.btn-outline-secondary"
      )
      .forEach((el) => {
        if (el && el.id !== "btnDebugPrint") el.style.display = "none";
      });
    document.querySelectorAll(".input-group .btn").forEach((el) => {
      if (el) el.style.display = "none";
    });

    document
      .querySelectorAll(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea, select'
      )
      .forEach((el) => {
        const valueSpan = document.createElement("span");
        valueSpan.className = "printed-value";
        let displayValue = "(vazio)";
        if (el.tagName === "SELECT" && el.options[el.selectedIndex]) {
          displayValue = el.options[el.selectedIndex].text || "(vazio)";
        } else if (el.type === "date" && el.value) {
          try {
            displayValue = new Date(el.value + "T00:00:00Z").toLocaleDateString(
              "pt-BR",
              { timeZone: "UTC" }
            );
          } catch (e) {
            displayValue = el.value;
          }
        } else if (el.value) {
          displayValue = el.value;
        }

        if (
          (el.id === "turmaEncarregadoDisplay" ||
            el.id === "responsavelAprDisplay") &&
          !el.value
        ) {
          displayValue = "(Não selecionado)";
        }

        valueSpan.textContent = displayValue;
        valueSpan.style.padding = "2px 0px";
        valueSpan.style.display = "inline-block";
        valueSpan.style.width = "100%";
        valueSpan.style.borderBottom = "1px dotted #999";
        valueSpan.style.minHeight = "1.2em";
        valueSpan.style.lineHeight = "1.2em";

        const parent = el.parentNode;
        if (parent) {
          if (parent.classList.contains("input-group")) {
            if (parent.parentNode) {
              parent.parentNode.insertBefore(valueSpan, parent);
              parent.style.display = "none";
            }
          } else {
            parent.insertBefore(valueSpan, el);
            el.style.display = "none";
          }
        }
      });

    document
      .querySelectorAll('input[type="text"].form-control[readonly]')
      .forEach((el) => {
        if (
          el.id === "turmaEncarregadoDisplay" ||
          el.id === "responsavelAprDisplay"
        )
          return;

        const valueSpan = document.createElement("span");
        valueSpan.className = "printed-value-readonly";
        valueSpan.textContent = el.value || "(vazio)";
        valueSpan.style.padding = "2px 0px";
        valueSpan.style.display = "inline-block";
        if (el.parentNode && el.parentNode.classList.contains("input-group")) {
          el.parentNode.parentNode.insertBefore(valueSpan, el.parentNode);
          el.parentNode.style.display = "none";
        } else if (el.parentNode) {
          el.parentNode.insertBefore(valueSpan, el);
          el.style.display = "none";
        }
      });

    document
      .querySelectorAll('input[type="radio"], input[type="checkbox"]')
      .forEach((cb) => {
        const replacement = document.createElement("span");
        replacement.style.fontFamily = "Arial, sans-serif";
        replacement.style.display = "inline-block";
        replacement.style.width = "12px";
        replacement.style.height = "12px";
        replacement.style.border = "1px solid #333";
        replacement.style.marginRight = "5px";
        replacement.style.verticalAlign = "middle";
        replacement.style.textAlign = "center";
        replacement.style.lineHeight = "10px";
        replacement.style.fontSize = "9px";
        if (cb.checked) {
          replacement.innerHTML = "&#x2714;";
        } else {
          replacement.innerHTML = "&nbsp;";
        }

        let label = cb.labels && cb.labels.length > 0 ? cb.labels[0] : null;
        if (!label && cb.id) {
          label = document.querySelector(`label[for="${cb.id}"]`);
        }

        if (label) {
          if (label.contains(cb)) {
            label.insertBefore(replacement, cb);
          } else {
            label.prepend(replacement);
          }
        } else if (cb.parentNode) {
          cb.parentNode.insertBefore(replacement, cb);
        }
        cb.style.display = "none";
      });
    document.body.classList.add("pdf-print-mode-active");
    console.log(
      "Client: Page prepared. Signaling PDF_PAGE_IS_READY_FOR_PRINTING"
    );
  }

  async function initializePage() {
    popularChecklistsEPerguntas();
    await carregarInfoServico();
    if (!isPrintMode) {
      await carregarDadosModalEncarregados();
      await carregarDadosModalResponsaveisAPR();
      await carregarServicosAPRModal();
      await carregarMateriaisAPRModal();
    }
    await carregarAPRExistente();

    if (
      empregadosListaDiv &&
      empregadosListaDiv.children.length === 0 &&
      !isPrintMode
    ) {
    }
    if (
      atividadesListaDiv &&
      atividadesListaDiv.children.length === 0 &&
      !isPrintMode
    ) {
    }
    if (
      materiaisListaDiv &&
      materiaisListaDiv.children.length === 0 &&
      !isPrintMode
    ) {
    }

    if (isPrintMode) {
      console.log(
        "Client: Print mode detected. Preparing page for PDF generation..."
      );
      setFormEditable(false);
      preparePageForPrinting();
      console.log("PDF_PAGE_IS_READY_FOR_PRINTING");
    } else {
      setFormEditable(isEditingEnabled);
      if (btnEditarAPR) {
        btnEditarAPR.addEventListener("click", () => {
          isEditingEnabled = true;
          setFormEditable(true);
        });
      }
    }
  }

  if (aprForm && !isPrintMode) {
    aprForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isEditingEnabled && !isPrintMode) {
        alert(
          "Clique em 'Editar APR' para habilitar a edição antes de salvar."
        );
        return;
      }

      const btnSubmit = e.target.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Salvando...';
      }

      const formData = new FormData(aprForm);
      const dadosAPR = {};

      for (const [key, value] of formData.entries()) {
        const element = aprForm.elements[key];
        if (
          element &&
          (element.type === "checkbox" ||
            (element[0] && element[0].type === "checkbox"))
        ) {
          if (key === "apr_motivo_parada") {
            if (!dadosAPR[key]) dadosAPR[key] = [];
            if (
              aprForm.elements[key].checked ||
              (element.length &&
                Array.from(element).some(
                  (el) => el.checked && el.value === value
                ))
            ) {
              dadosAPR[key].push(value);
            }
          } else {
            dadosAPR[key] = aprForm.elements[key].checked;
          }
        } else if (
          element &&
          (element.type === "radio" ||
            (element[0] && element[0].type === "radio"))
        ) {
          const radioChecked = aprForm.querySelector(
            `input[name="${key}"]:checked`
          );
          dadosAPR[key] = radioChecked ? radioChecked.value : null;
        } else {
          dadosAPR[key] = value;
        }
      }

      dadosAPR.apr_empregados_lista = [];
      document
        .querySelectorAll("#aprEmpregadosLista .row-participante")
        .forEach((row) => {
          const matricula = row.dataset.matricula;
          const nomeSpan = row.querySelector(
            ".col-6 span.selected-item-display"
          );
          const nome = nomeSpan ? nomeSpan.textContent : "N/A";
          if (matricula) {
            dadosAPR.apr_empregados_lista.push({ matricula, nome });
          }
        });

      dadosAPR.apr_atividades_executadas_lista = [];
      document
        .querySelectorAll("#aprAtividadesRealizadasLista .row-atividade")
        .forEach((row) => {
          const codigo = row.querySelector(
            'input[name^="atividade_codigo_"]'
          ).value;
          const descricao = row.querySelector(
            'input[name^="atividade_descricao_"]'
          ).value;
          const quantidade = row.querySelector(
            'input[name^="atividade_quantidade_"]'
          ).value;
          const unidade = row.querySelector(
            'input[name^="atividade_unidade_"]'
          ).value;
          if (descricao) {
            dadosAPR.apr_atividades_executadas_lista.push({
              codigo,
              descricao,
              quantidade,
              unidade,
            });
          }
        });

      dadosAPR.apr_materiais_utilizados_lista = [];
      document
        .querySelectorAll("#aprMateriaisGastosLista .row-material")
        .forEach((row) => {
          const codigo = row.querySelector(
            'input[name^="material_codigo_"]'
          ).value;
          const quantidade = row.querySelector(
            'input[name^="material_quantidade_"]'
          ).value;
          const descricao = row.querySelector(
            'input[name^="material_descricao_"]'
          ).value;
          if (descricao) {
            dadosAPR.apr_materiais_utilizados_lista.push({
              codigo,
              quantidade,
              descricao,
            });
          }
        });

      definicoesAPR.medidasControle.forEach((medida) => {
        const checkbox = aprForm.elements[medida.chave];
        if (checkbox) dadosAPR[medida.chave] = checkbox.checked;
        else dadosAPR[medida.chave] = false;
      });
      definicoesAPR.riscosEspecificos.forEach((risco) => {
        const checkbox = aprForm.elements[risco.chave];
        if (checkbox) dadosAPR[risco.chave] = checkbox.checked;
        else dadosAPR[risco.chave] = false;
      });
      const outrosCheck = aprForm.elements["risco_outros_check"];
      if (outrosCheck) dadosAPR["risco_outros_check"] = outrosCheck.checked;
      else dadosAPR["risco_outros_check"] = false;

      const processoOriginalInput = document.getElementById(
        "infoServicoProcessoOriginal"
      );
      if (processoOriginalInput) {
        dadosAPR.processo_numero_original_servico = processoOriginalInput.value;
      }

      try {
        const response = await fetch(`/api/servicos/${servicoId}/apr-dados`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dadosAPR),
        });
        const resultado = await response.json();
        if (resultado.success) {
          alert("APR salva com sucesso!");
          if (aprIdHidden) aprIdHidden.value = resultado.aprId;
          if (!isPrintMode) {
            window.location.href = "/servicos_ativos";
          }
        } else {
          throw new Error(
            resultado.message || "Erro desconhecido ao salvar APR."
          );
        }
      } catch (error) {
        console.error("Erro ao submeter APR:", error);
        alert(`Erro: ${error.message}`);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar APR';
        }
      }
    });
  }
  initializePage();
});
