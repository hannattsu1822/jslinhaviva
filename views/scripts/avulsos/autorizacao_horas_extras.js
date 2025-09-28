document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formHorasExtras");
  if (!form) return;

  const btnAdicionarLinha = document.getElementById("btnAdicionarLinha");
  const corpoTabelaHorasExtras = document.getElementById(
    "corpoTabelaHorasExtras"
  );
  const nomeEmpregadoInput = document.getElementById("nomeEmpregado");
  const matriculaInput = document.getElementById("matricula");
  const nomeEmpregadoOutput = document.getElementById("nomeEmpregadoOutput");
  const dataSolicitacaoInput = document.getElementById("dataSolicitacao");
  const mesAnoInput = document.getElementById("mesAno");

  const modalEmpregadoElement = document.getElementById("modalEmpregado");
  const modalEmpregado = new bootstrap.Modal(modalEmpregadoElement);
  const selectTurmaEncarregado = document.getElementById(
    "selectTurmaEncarregado"
  );
  const selectEmpregadoDaTurma = document.getElementById(
    "selectEmpregadoDaTurma"
  );
  const btnConfirmarSelecaoEmpregado = document.getElementById(
    "btnConfirmarSelecaoEmpregado"
  );

  if (dataSolicitacaoInput) {
    dataSolicitacaoInput.valueAsDate = new Date();
  }

  if (mesAnoInput) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = (hoje.getMonth() + 1).toString().padStart(2, "0");
    mesAnoInput.value = `${ano}-${mes}`;
  }

  modalEmpregadoElement.addEventListener(
    "shown.bs.modal",
    carregarTurmasEncarregados
  );

  async function carregarTurmasEncarregados() {
    selectTurmaEncarregado.innerHTML =
      '<option value="">-- Carregando Turmas --</option>';
    selectEmpregadoDaTurma.innerHTML =
      '<option value="">-- Selecione uma Turma Primeiro --</option>';
    selectEmpregadoDaTurma.disabled = true;
    btnConfirmarSelecaoEmpregado.disabled = true;
    try {
      const response = await fetch("/api/avulsos/turmas-encarregados");
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const turmas = await response.json();

      selectTurmaEncarregado.innerHTML =
        '<option value="" selected disabled>-- Selecione a Turma (Encarregado) --</option>';
      turmas.forEach((turma) => {
        const option = document.createElement("option");
        option.value = turma.turma_encarregado;
        option.textContent = turma.nome_encarregado
          ? `${turma.turma_encarregado} - ${turma.nome_encarregado}`
          : turma.turma_encarregado;
        selectTurmaEncarregado.appendChild(option);
      });
    } catch (error) {
      selectTurmaEncarregado.innerHTML =
        '<option value="">-- Erro ao carregar --</option>';
    }
  }

  selectTurmaEncarregado.addEventListener("change", async function () {
    const turmaEncarregadoId = this.value;
    selectEmpregadoDaTurma.innerHTML =
      '<option value="">-- Carregando Empregados --</option>';
    selectEmpregadoDaTurma.disabled = true;
    btnConfirmarSelecaoEmpregado.disabled = true;

    if (!turmaEncarregadoId) {
      selectEmpregadoDaTurma.innerHTML =
        '<option value="">-- Selecione uma Turma Primeiro --</option>';
      return;
    }

    try {
      const response = await fetch(
        `/api/avulsos/turmas/${turmaEncarregadoId}/empregados`
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const empregados = await response.json();

      selectEmpregadoDaTurma.innerHTML =
        '<option value="" selected disabled>-- Selecione o Empregado --</option>';
      empregados.forEach((emp) => {
        const option = document.createElement("option");
        option.value = emp.matricula;
        option.textContent = `${emp.nome} (Mat: ${emp.matricula})`;
        option.dataset.nome = emp.nome;
        option.dataset.matricula = emp.matricula;
        selectEmpregadoDaTurma.appendChild(option);
      });
      selectEmpregadoDaTurma.disabled = false;
    } catch (error) {
      selectEmpregadoDaTurma.innerHTML =
        '<option value="">-- Erro ao carregar --</option>';
    }
  });

  selectEmpregadoDaTurma.addEventListener("change", function () {
    btnConfirmarSelecaoEmpregado.disabled = !this.value;
  });

  btnConfirmarSelecaoEmpregado.addEventListener("click", () => {
    const selectedOption =
      selectEmpregadoDaTurma.options[selectEmpregadoDaTurma.selectedIndex];
    if (selectedOption && selectedOption.value) {
      nomeEmpregadoInput.value = selectedOption.dataset.nome;
      matriculaInput.value = selectedOption.dataset.matricula;
      nomeEmpregadoOutput.textContent = selectedOption.dataset.nome;
      modalEmpregado.hide();
    }
  });

  let contadorLinha = 0;
  function adicionarLinha() {
    contadorLinha++;
    const newRow = corpoTabelaHorasExtras.insertRow();
    newRow.innerHTML = `
            <td><input type="date" name="detalhe_${contadorLinha}_dia" class="form-control form-control-sm" required></td>
            <td><input type="time" name="detalhe_${contadorLinha}_inicioPrevisto" class="form-control form-control-sm hora-inicio-prevista"></td>
            <td><input type="time" name="detalhe_${contadorLinha}_terminoPrevisto" class="form-control form-control-sm hora-termino-prevista"></td>
            <td><input type="time" name="detalhe_${contadorLinha}_inicioRealizado" class="form-control form-control-sm hora-inicio-realizada" required></td>
            <td><input type="time" name="detalhe_${contadorLinha}_terminoRealizado" class="form-control form-control-sm hora-termino-realizada" required></td>
            <td><input type="number" name="detalhe_${contadorLinha}_qtdeHoras" class="form-control form-control-sm qtde-horas" step="0.01" readonly></td>
            <td>
                <select name="detalhe_${contadorLinha}_motivo" class="form-select form-select-sm motivo-select" required>
                    <option value="">Selecione</option>
                    <option value="Ocorrência de Emergência">Emergência</option>
                    <option value="Ocorrência de Deslocamento">Deslocamento</option>
                    <option value="Ocorrência de Serviço Longo">Serviço Longo</option>
                    <option value="Outro">Outro</option>
                </select>
                <textarea name="detalhe_${contadorLinha}_motivoOutro" class="form-control form-control-sm motivo-outro-textarea" rows="1" style="display:none; margin-top:5px;" placeholder="Especificar"></textarea>
            </td>
            <td>
                <select name="detalhe_${contadorLinha}_autorizadoPreviamente" class="form-select form-select-sm">
                    <option value="Sim">Sim</option>
                    <option value="Não" selected>Não</option>
                </select>
            </td>
            <td><input type="checkbox" name="detalhe_${contadorLinha}_pagar" class="form-check-input checkbox-pagar"></td>
            <td><input type="checkbox" name="detalhe_${contadorLinha}_compensar" class="form-check-input checkbox-compensar"></td>
            <td>
                <select name="detalhe_${contadorLinha}_vistoGerente" class="form-select form-select-sm" required>
                    <option value="">--</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                </select>
            </td>
            <td class="no-print"><button type="button" class="btn btn-danger btn-sm btn-remover-linha"><i class="fa-solid fa-trash-can"></i></button></td>
        `;

    newRow
      .querySelector(".btn-remover-linha")
      .addEventListener("click", () => newRow.remove());
    const motivoSelect = newRow.querySelector(".motivo-select");
    const motivoOutroTextarea = newRow.querySelector(".motivo-outro-textarea");
    motivoSelect.addEventListener("change", function () {
      motivoOutroTextarea.style.display =
        this.value === "Outro" ? "block" : "none";
      motivoOutroTextarea.required = this.value === "Outro";
    });

    const inicioRealizadoInput = newRow.querySelector(".hora-inicio-realizada");
    const terminoRealizadoInput = newRow.querySelector(
      ".hora-termino-realizada"
    );
    const qtdeHorasInput = newRow.querySelector(".qtde-horas");

    function calcularHoras() {
      if (inicioRealizadoInput.value && terminoRealizadoInput.value) {
        const inicio = new Date(`1970-01-01T${inicioRealizadoInput.value}:00Z`);
        let termino = new Date(`1970-01-01T${terminoRealizadoInput.value}:00Z`);
        if (termino < inicio) termino.setDate(termino.getDate() + 1);
        const diffMs = termino - inicio;
        qtdeHorasInput.value = diffMs >= 0 ? (diffMs / 3600000).toFixed(2) : "";
      } else {
        qtdeHorasInput.value = "";
      }
    }
    inicioRealizadoInput.addEventListener("change", calcularHoras);
    terminoRealizadoInput.addEventListener("change", calcularHoras);
  }

  btnAdicionarLinha.addEventListener("click", adicionarLinha);
  adicionarLinha();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      event.stopPropagation();
      form.classList.add("was-validated");
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const data = {
      nomeEmpregado: nomeEmpregadoInput.value,
      matricula: matriculaInput.value,
      setor: form.setor.value,
      mesAno: form.mesAno.value,
      dataSolicitacao: form.dataSolicitacao.value,
      detalhes: [],
    };

    const linhas = corpoTabelaHorasExtras.querySelectorAll("tr");
    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      const counter = linha
        .querySelector('[name^="detalhe_"]')
        .name.match(/detalhe_(\d+)_/)[1];
      let motivoValue = linha.querySelector(
        `[name="detalhe_${counter}_motivo"]`
      ).value;
      if (motivoValue === "Outro") {
        motivoValue = linha
          .querySelector(`[name="detalhe_${counter}_motivoOutro"]`)
          .value.trim();
      }
      const detalheLinha = {
        dia: linha.querySelector(`[name="detalhe_${counter}_dia"]`).value,
        inicioPrevisto:
          linha.querySelector(`[name="detalhe_${counter}_inicioPrevisto"]`)
            .value || null,
        terminoPrevisto:
          linha.querySelector(`[name="detalhe_${counter}_terminoPrevisto"]`)
            .value || null,
        inicioRealizado: linha.querySelector(
          `[name="detalhe_${counter}_inicioRealizado"]`
        ).value,
        terminoRealizado: linha.querySelector(
          `[name="detalhe_${counter}_terminoRealizado"]`
        ).value,
        qtdeHoras: linha.querySelector(`[name="detalhe_${counter}_qtdeHoras"]`)
          .value,
        motivo: motivoValue,
        autorizadoPreviamente: linha.querySelector(
          `[name="detalhe_${counter}_autorizadoPreviamente"]`
        ).value,
        pagar: linha.querySelector(`[name="detalhe_${counter}_pagar"]`).checked,
        compensar: linha.querySelector(`[name="detalhe_${counter}_compensar"]`)
          .checked,
        vistoGerente: linha.querySelector(
          `[name="detalhe_${counter}_vistoGerente"]`
        ).value,
      };
      if (
        detalheLinha.dia &&
        detalheLinha.inicioRealizado &&
        detalheLinha.terminoRealizado
      ) {
        data.detalhes.push(detalheLinha);
      }
    }

    if (data.detalhes.length === 0) {
      alert("Adicione e preencha pelo menos um detalhe de hora extra.");
      return;
    }

    try {
      const response = await fetch("/api/avulsos/autorizacao-horas-extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      alert(
        result.message ||
          (response.ok
            ? "Solicitação enviada com sucesso!"
            : "Erro ao enviar solicitação.")
      );
      if (response.ok) {
        form.reset();
        nomeEmpregadoOutput.textContent = "[Nome do Empregado]";
        corpoTabelaHorasExtras.innerHTML = "";
        adicionarLinha();
        form.classList.remove("was-validated");
      }
    } catch (error) {
      alert("Erro de conexão ao enviar a solicitação.");
    }
  });

  const btnPrint = document.getElementById("btnPrint");
  btnPrint.addEventListener("click", () => window.print());
});
