document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("formHorasExtras");
  const btnAdicionarLinha = document.getElementById("btnAdicionarLinha");
  const corpoTabelaHorasExtras = document.getElementById(
    "corpoTabelaHorasExtras"
  );

  const nomeEmpregadoInput = document.getElementById("nomeEmpregado");
  const matriculaInput = document.getElementById("matricula");
  const nomeEmpregadoOutput = document.getElementById("nomeEmpregadoOutput");
  const dataSolicitacaoInput = document.getElementById("dataSolicitacao");
  const mesAnoInput = document.getElementById("mesAno");

  const modalEmpregado = document.getElementById("modalEmpregado");
  const btnAbrirModalEmpregado = document.getElementById(
    "btnAbrirModalEmpregado"
  );
  const closeModalEmpregado = document.getElementById("closeModalEmpregado");
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

  if (btnAbrirModalEmpregado) {
    btnAbrirModalEmpregado.addEventListener("click", () => {
      modalEmpregado.style.display = "block";
      carregarTurmasEncarregados();
      document.getElementById("setor").value = "";
    });
  }

  if (closeModalEmpregado) {
    closeModalEmpregado.addEventListener("click", () => {
      modalEmpregado.style.display = "none";
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target == modalEmpregado) {
      modalEmpregado.style.display = "none";
    }
  });

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
        '<option value="">-- Selecione a Turma (Encarregado) --</option>';
      turmas.forEach((turma) => {
        const option = document.createElement("option");
        option.value = turma.turma_encarregado;
        option.textContent = turma.nome_encarregado
          ? `${turma.turma_encarregado} - ${turma.nome_encarregado}`
          : turma.turma_encarregado;
        selectTurmaEncarregado.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao carregar turmas:", error);
      selectTurmaEncarregado.innerHTML =
        '<option value="">-- Erro ao carregar --</option>';
    }
  }

  if (selectTurmaEncarregado) {
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
          '<option value="">-- Selecione o Empregado --</option>';
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
        console.error("Erro ao carregar empregados da turma:", error);
        selectEmpregadoDaTurma.innerHTML =
          '<option value="">-- Erro ao carregar --</option>';
      }
    });
  }

  if (selectEmpregadoDaTurma) {
    selectEmpregadoDaTurma.addEventListener("change", function () {
      btnConfirmarSelecaoEmpregado.disabled = !this.value;
    });
  }

  if (btnConfirmarSelecaoEmpregado) {
    btnConfirmarSelecaoEmpregado.addEventListener("click", () => {
      const selectedOption =
        selectEmpregadoDaTurma.options[selectEmpregadoDaTurma.selectedIndex];
      if (selectedOption && selectedOption.value) {
        nomeEmpregadoInput.value = selectedOption.dataset.nome;
        matriculaInput.value = selectedOption.dataset.matricula;
        nomeEmpregadoOutput.textContent = selectedOption.dataset.nome;
        modalEmpregado.style.display = "none";
      } else {
        alert("Por favor, selecione um empregado.");
      }
    });
  }

  let contadorLinha = 0;

  function adicionarLinha() {
    contadorLinha++;
    const newRow = corpoTabelaHorasExtras.insertRow();
    newRow.innerHTML = `
            <td><input type="date" name="detalhe_${contadorLinha}_dia" required></td>
            <td><input type="time" name="detalhe_${contadorLinha}_inicioPrevisto" class="hora-inicio-prevista"></td>
            <td><input type="time" name="detalhe_${contadorLinha}_terminoPrevisto" class="hora-termino-prevista"></td>
            <td><input type="time" name="detalhe_${contadorLinha}_inicioRealizado" class="hora-inicio-realizada" required></td>
            <td><input type="time" name="detalhe_${contadorLinha}_terminoRealizado" class="hora-termino-realizada" required></td>
            <td><input type="number" name="detalhe_${contadorLinha}_qtdeHoras" class="qtde-horas" step="0.01" readonly></td>
            <td>
                <select name="detalhe_${contadorLinha}_motivo" class="motivo-select" required>
                    <option value="">-- Selecione --</option>
                    <option value="Ocorrência de Emergência">Ocorrência de Emergência</option>
                    <option value="Ocorrência de Deslocamento">Ocorrência de Deslocamento</option>
                    <option value="Ocorrência de Serviço Longo">Ocorrência de Serviço Longo</option>
                    <option value="Outro">Outro (especificar)</option>
                </select>
                <textarea name="detalhe_${contadorLinha}_motivoOutro" class="motivo-outro-textarea" rows="1" style="display:none; margin-top:5px; width:100%;" placeholder="Especificar motivo"></textarea>
            </td>
            <td>
                <select name="detalhe_${contadorLinha}_autorizadoPreviamente">
                    <option value="">--</option>
                    <option value="Sim">Sim</option>
                    <option value="Não" selected>Não</option>
                </select>
            </td>
            <td><input type="checkbox" name="detalhe_${contadorLinha}_pagar" class="checkbox-pagar"></td>
            <td><input type="checkbox" name="detalhe_${contadorLinha}_compensar" class="checkbox-compensar"></td>
            <td>
                <select name="detalhe_${contadorLinha}_vistoGerente" required>
                    <option value="">--</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                </select>
            </td>
            <td><button type="button" class="btn-danger btn-remover-linha no-print">Remover</button></td>
        `;

    newRow
      .querySelector(".btn-remover-linha")
      .addEventListener("click", function () {
        newRow.remove();
      });

    const motivoSelect = newRow.querySelector(".motivo-select");
    const motivoOutroTextarea = newRow.querySelector(".motivo-outro-textarea");
    motivoSelect.addEventListener("change", function () {
      if (this.value === "Outro") {
        motivoOutroTextarea.style.display = "block";
        motivoOutroTextarea.required = true;
      } else {
        motivoOutroTextarea.style.display = "none";
        motivoOutroTextarea.required = false;
        motivoOutroTextarea.value = "";
      }
    });

    const inicioPrevistoInput = newRow.querySelector(".hora-inicio-prevista");
    const terminoPrevistoInput = newRow.querySelector(".hora-termino-prevista");
    const inicioRealizadoInput = newRow.querySelector(".hora-inicio-realizada");
    const terminoRealizadoInput = newRow.querySelector(
      ".hora-termino-realizada"
    );
    const qtdeHorasInput = newRow.querySelector(".qtde-horas");

    function calcularHorasEAtualizarPrevistas() {
      if (inicioRealizadoInput.value) {
        inicioPrevistoInput.value = inicioRealizadoInput.value;
      } else {
        inicioPrevistoInput.value = "";
      }
      if (terminoRealizadoInput.value) {
        terminoPrevistoInput.value = terminoRealizadoInput.value;
      } else {
        terminoPrevistoInput.value = "";
      }

      if (inicioRealizadoInput.value && terminoRealizadoInput.value) {
        const inicio = new Date(`1970-01-01T${inicioRealizadoInput.value}:00Z`);
        let termino = new Date(`1970-01-01T${terminoRealizadoInput.value}:00Z`);

        if (termino < inicio) {
          termino.setDate(termino.getDate() + 1);
        }

        const diffMs = termino - inicio;
        if (diffMs >= 0) {
          const diffHrs = diffMs / (1000 * 60 * 60);
          qtdeHorasInput.value = diffHrs.toFixed(2);
        } else {
          qtdeHorasInput.value = "";
        }
      } else {
        qtdeHorasInput.value = "";
      }
    }
    inicioRealizadoInput.addEventListener(
      "change",
      calcularHorasEAtualizarPrevistas
    );
    terminoRealizadoInput.addEventListener(
      "change",
      calcularHorasEAtualizarPrevistas
    );
  }

  if (btnAdicionarLinha) {
    btnAdicionarLinha.addEventListener("click", adicionarLinha);
  }
  adicionarLinha();

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      if (!nomeEmpregadoInput.value || !matriculaInput.value) {
        alert(
          'Por favor, selecione um empregado usando o botão "Selecionar Empregado".'
        );
        btnAbrirModalEmpregado.focus();
        return;
      }
      if (!document.getElementById("setor").value) {
        alert("Por favor, selecione o Setor.");
        document.getElementById("setor").focus();
        return;
      }

      const formDataRaw = new FormData(form);
      const data = {
        nomeEmpregado: nomeEmpregadoInput.value,
        matricula: matriculaInput.value,
        setor: formDataRaw.get("setor"),
        mesAno: formDataRaw.get("mesAno"),
        dataSolicitacao: formDataRaw.get("dataSolicitacao"),
        detalhes: [],
      };

      const linhas = corpoTabelaHorasExtras.querySelectorAll("tr");
      let temDetalheValidoParaEnvio = false;

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const firstInputName = linha.querySelector(
          'input[name^="detalhe_"], select[name^="detalhe_"], textarea[name^="detalhe_"]'
        )?.name;

        if (!firstInputName) continue;

        const counterMatch = firstInputName.match(/detalhe_(\d+)_/);
        if (!counterMatch) continue;
        const counter = counterMatch[1];

        let motivoValue = formDataRaw.get(`detalhe_${counter}_motivo`);
        const motivoOutroValue = formDataRaw.get(
          `detalhe_${counter}_motivoOutro`
        );

        if (motivoValue === "Outro") {
          if (!motivoOutroValue || motivoOutroValue.trim() === "") {
            alert(
              `Por favor, especifique o motivo para "Outro" na linha de detalhe ${
                i + 1
              }.`
            );
            linha.querySelector(".motivo-outro-textarea").focus();
            return;
          }
          motivoValue = motivoOutroValue.trim();
        }

        const detalheLinha = {
          dia: formDataRaw.get(`detalhe_${counter}_dia`),
          inicioPrevisto:
            formDataRaw.get(`detalhe_${counter}_inicioPrevisto`) || null,
          terminoPrevisto:
            formDataRaw.get(`detalhe_${counter}_terminoPrevisto`) || null,
          inicioRealizado: formDataRaw.get(
            `detalhe_${counter}_inicioRealizado`
          ),
          terminoRealizado: formDataRaw.get(
            `detalhe_${counter}_terminoRealizado`
          ),
          qtdeHoras: formDataRaw.get(`detalhe_${counter}_qtdeHoras`),
          motivo: motivoValue,
          autorizadoPreviamente: formDataRaw.get(
            `detalhe_${counter}_autorizadoPreviamente`
          ),
          pagar: linha.querySelector(`input[name="detalhe_${counter}_pagar"]`)
            .checked,
          compensar: linha.querySelector(
            `input[name="detalhe_${counter}_compensar"]`
          ).checked,
          vistoGerente: formDataRaw.get(`detalhe_${counter}_vistoGerente`),
        };

        if (!detalheLinha.vistoGerente) {
          alert(
            `Por favor, selecione o Visto do Gerente (Sim/Não) na linha de detalhe ${
              i + 1
            }.`
          );
          linha
            .querySelector(`select[name="detalhe_${counter}_vistoGerente"]`)
            .focus();
          return;
        }

        if (
          detalheLinha.dia &&
          detalheLinha.inicioRealizado &&
          detalheLinha.terminoRealizado &&
          detalheLinha.motivo &&
          detalheLinha.qtdeHoras
        ) {
          data.detalhes.push(detalheLinha);
          temDetalheValidoParaEnvio = true;
        } else if (
          detalheLinha.dia ||
          detalheLinha.inicioRealizado ||
          detalheLinha.terminoRealizado ||
          detalheLinha.motivo
        ) {
          alert(
            `A linha de detalhe ${
              i + 1
            } está incompleta. Preencha todos os campos obrigatórios.`
          );
          return;
        }
      }

      if (
        !temDetalheValidoParaEnvio &&
        corpoTabelaHorasExtras.querySelectorAll("tr").length > 0
      ) {
        alert(
          "Nenhuma linha de detalhe válida foi preenchida. Verifique os campos obrigatórios."
        );
        return;
      }
      if (data.detalhes.length === 0) {
        alert(
          "Por favor, adicione e preencha pelo menos um detalhe de hora extra."
        );
        btnAdicionarLinha.focus();
        return;
      }

      try {
        const response = await fetch("/api/avulsos/autorizacao-horas-extras", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          const result = await response.json();
          alert(result.message || "Solicitação enviada com sucesso!");
          form.reset();
          nomeEmpregadoInput.value = "";
          matriculaInput.value = "";
          nomeEmpregadoOutput.textContent = "[Nome do Empregado]";
          if (mesAnoInput) {
            const hoje = new Date();
            const ano = hoje.getFullYear();
            const mes = (hoje.getMonth() + 1).toString().padStart(2, "0");
            mesAnoInput.value = `${ano}-${mes}`;
          }
          if (dataSolicitacaoInput)
            dataSolicitacaoInput.valueAsDate = new Date();
          document.getElementById("setor").value = "";

          corpoTabelaHorasExtras.innerHTML = "";
          adicionarLinha();
        } else {
          const errorResult = await response.json();
          alert(
            `Erro: ${
              errorResult.message || "Não foi possível enviar a solicitação."
            }`
          );
        }
      } catch (error) {
        console.error("Erro ao enviar formulário:", error);
        alert("Erro de conexão ao enviar a solicitação.");
      }
    });
  }

  const btnPrint = document.getElementById("btnPrint");
  if (btnPrint) {
    btnPrint.addEventListener("click", function () {
      const nomeEmpregado = nomeEmpregadoInput.value || " ";
      const matricula = matriculaInput.value || " ";
      const setorSelect = document.getElementById("setor");
      const setor = setorSelect.options[setorSelect.selectedIndex]?.text || " ";

      let mesAno = mesAnoInput.value || " ";
      if (mesAno && mesAno.includes("-")) {
        const [anoForm, mesForm] = mesAno.split("-");
        mesAno = `${mesForm}/${anoForm}`;
      }

      const dataSolicitacaoVal = dataSolicitacaoInput.value;
      let dataSolicitacaoFormatada = " ";
      if (dataSolicitacaoVal) {
        const [anoForm, mesForm, diaForm] = dataSolicitacaoVal.split("-");
        dataSolicitacaoFormatada = `${diaForm}/${mesForm}/${anoForm}`;
      }

      const tableContent = [];
      const linhas = corpoTabelaHorasExtras.querySelectorAll("tr");
      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const firstInputName = linha.querySelector(
          'input[name^="detalhe_"], select[name^="detalhe_"], textarea[name^="detalhe_"]'
        )?.name;
        if (!firstInputName) continue;
        const counterMatch = firstInputName.match(/detalhe_(\d+)_/);
        if (!counterMatch) continue;
        const counter = counterMatch[1];

        let diaVal = linha.querySelector(
          `input[name="detalhe_${counter}_dia"]`
        ).value;
        if (diaVal && diaVal.includes("-")) {
          const [anoForm, mesForm, diaForm] = diaVal.split("-");
          diaVal = `${diaForm}/${mesForm}/${anoForm}`;
        }

        let motivoVal = linha.querySelector(
          `select[name="detalhe_${counter}_motivo"]`
        ).value;
        if (motivoVal === "Outro") {
          motivoVal = linha
            .querySelector(`textarea[name="detalhe_${counter}_motivoOutro"]`)
            .value.trim();
        }

        const vistoGerenteSelect = linha.querySelector(
          `select[name="detalhe_${counter}_vistoGerente"]`
        );
        const vistoGerenteVal = vistoGerenteSelect.value || " ";

        const rowData = [
          { text: diaVal || " ", style: "tableCell", alignment: "center" },
          {
            text:
              linha.querySelector(
                `input[name="detalhe_${counter}_inicioPrevisto"]`
              ).value || " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text:
              linha.querySelector(
                `input[name="detalhe_${counter}_terminoPrevisto"]`
              ).value || " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text:
              linha.querySelector(
                `input[name="detalhe_${counter}_inicioRealizado"]`
              ).value || " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text:
              linha.querySelector(
                `input[name="detalhe_${counter}_terminoRealizado"]`
              ).value || " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text:
              linha.querySelector(`input[name="detalhe_${counter}_qtdeHoras"]`)
                .value || " ",
            style: "tableCell",
            alignment: "center",
          },
          { text: motivoVal || " ", style: "tableCell", alignment: "left" },
          {
            text:
              linha.querySelector(
                `select[name="detalhe_${counter}_autorizadoPreviamente"]`
              ).value || " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text: linha.querySelector(`input[name="detalhe_${counter}_pagar"]`)
              .checked
              ? "X"
              : " ",
            style: "tableCell",
            alignment: "center",
          },
          {
            text: linha.querySelector(
              `input[name="detalhe_${counter}_compensar"]`
            ).checked
              ? "X"
              : " ",
            style: "tableCell",
            alignment: "center",
          },
          { text: vistoGerenteVal, style: "tableCell", alignment: "center" },
        ];
        tableContent.push(rowData);
      }
      if (tableContent.length === 0 && linhas.length > 0) {
        alert(
          "Preencha ao menos uma linha de detalhe completamente para gerar o PDF."
        );
        return;
      }
      if (linhas.length === 0) {
        alert("Adicione ao menos uma linha de detalhe para gerar o PDF.");
        return;
      }

      const docDefinition = {
        pageOrientation: "landscape",
        pageSize: "A4",
        pageMargins: [30, 40, 30, 40],
        content: [
          {
            text: "AUTORIZAÇÃO PARA REALIZAÇÃO DE SERVIÇO EXTRAORDINÁRIO",
            style: "mainHeader",
            alignment: "center",
          },
          {
            text: "Companhia Sul Sergipana de Eletricidade – SULGIPE",
            style: "subHeader",
            alignment: "center",
            margin: [0, 0, 0, 20],
          },

          {
            columns: [
              {
                width: "*",
                stack: [
                  {
                    text: [
                      { text: "Nome do Empregado: ", style: "infoKey" },
                      { text: nomeEmpregado, style: "infoValue" },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    text: [
                      { text: "Setor: ", style: "infoKey" },
                      { text: setor, style: "infoValue" },
                    ],
                  },
                ],
              },
              {
                width: "auto",
                alignment: "right",
                stack: [
                  {
                    text: [
                      { text: "Matrícula: ", style: "infoKey" },
                      { text: matricula, style: "infoValue" },
                    ],
                    margin: [0, 0, 0, 4],
                  },
                  {
                    text: [
                      { text: "Mês/Ano: ", style: "infoKey" },
                      { text: mesAno, style: "infoValue" },
                    ],
                  },
                ],
              },
            ],
            columnGap: 20,
            margin: [0, 0, 0, 20],
          },
          {
            table: {
              headerRows: 2,
              // Ajuste de larguras: Pagar (30), Compensar (40), Visto Gerente (50)
              widths: [55, 55, 55, 55, 55, 45, "*", 60, 30, 40, 50],
              body: [
                [
                  {
                    text: "Dia",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Início Prev.",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Término Prev.",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Início Real.",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Término Real.",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Qtde Horas",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Motivo",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 5, 0, 0],
                  },
                  {
                    text: "Autorizado (S/N)",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 0, 0, 0],
                  },
                  {
                    text: "Horas extras",
                    style: "tableHeader",
                    alignment: "center",
                    colSpan: 2,
                  },
                  {},
                  // Visto Gerente com quebra de linha e ajuste de margem para centralização vertical
                  {
                    text: "VISTO\nGERENTE\n(S/N)",
                    style: "tableHeader",
                    alignment: "center",
                    rowSpan: 2,
                    margin: [0, 2, 0, 0],
                  },
                ],
                [
                  {},
                  {},
                  {},
                  {},
                  {},
                  {},
                  {},
                  {},
                  { text: "Pagar", style: "tableHeader", alignment: "center" },
                  {
                    text: "Compensar",
                    style: "tableHeader",
                    fontSize: 7,
                    alignment: "center",
                  }, // Fonte de Compensar ajustada
                  {}, // Célula vazia correspondente ao Visto Gerente (já que ele tem rowSpan:2)
                ],
                ...tableContent,
              ],
            },
            layout: {
              hLineWidth: function (i, node) {
                return i <= 2 || i === node.table.body.length ? 0.75 : 0.5;
              },
              vLineWidth: function (i, node) {
                return 0.75;
              },
              hLineColor: function (i, node) {
                return "#444444";
              },
              vLineColor: function (i, node) {
                return "#444444";
              },
              paddingLeft: function (i, node) {
                return 4;
              },
              paddingRight: function (i, node) {
                return 4;
              },
              paddingTop: function (i, node) {
                return 3;
              },
              paddingBottom: function (i, node) {
                return 3;
              },
            },
            margin: [0, 0, 0, 15],
          },

          {
            text: "Observações Importantes:",
            style: "sectionTitle",
            margin: [0, 5, 0, 5],
          },
          {
            ul: [
              "A solicitação para realização de serviços em horário extraordinário deve ser autorizada previamente, salvo em casos emergenciais.",
              "As horas realizadas em atividades emergenciais devem ser apresentadas ao gerente do setor no dia seguinte à sua realização.",
              "Este formulário deve ser encaminhado ao RH até o 1º dia útil do mês subsequente.",
              "O empregado é responsável por garantir o preenchimento correto e a assinatura do gerente antes do envio ao RH.",
              "As horas extras devem ser registradas corretamente no ponto eletrônico.",
            ],
            style: "listText",
            margin: [15, 0, 0, 15],
          },
          {
            text: [
              "Eu, ",
              {
                text: nomeEmpregado || "[Nome do Empregado]",
                bold: true,
                style: "baseText",
              },
              ", declaro que as informações fornecidas acima são verdadeiras e estou ciente das normas estabelecidas pela empresa sobre a realização de horas extras.",
            ],
            style: "baseText",
            margin: [0, 10, 0, 25],
          },
          {
            columns: [
              {
                stack: [
                  {
                    text: `Data: ${
                      dataSolicitacaoFormatada === " "
                        ? "____/____/____"
                        : dataSolicitacaoFormatada
                    }`,
                    style: "baseText",
                    margin: [0, 0, 0, 0],
                  },
                ],
                width: "auto",
                alignment: "left",
                margin: [0, 13, 0, 0],
              },
              {
                stack: [
                  {
                    canvas: [
                      {
                        type: "line",
                        x1: 0,
                        y1: 0,
                        x2: 180,
                        y2: 0,
                        lineWidth: 0.5,
                      },
                    ],
                    margin: [0, 15, 0, 2],
                  },
                  {
                    text: "Assinatura do Empregado",
                    style: "signatureText",
                    alignment: "center",
                  },
                ],
                width: "*",
                alignment: "center",
              },
              {
                stack: [
                  {
                    canvas: [
                      {
                        type: "line",
                        x1: 0,
                        y1: 0,
                        x2: 180,
                        y2: 0,
                        lineWidth: 0.5,
                      },
                    ],
                    margin: [0, 15, 0, 2],
                  },
                  {
                    text: "Assinatura do Gerente do Setor",
                    style: "signatureText",
                    alignment: "center",
                  },
                ],
                width: "*",
                alignment: "center",
              },
            ],
            columnGap: 20,
            margin: [0, 10, 0, 0],
          },
        ],
        defaultStyle: {
          fontSize: 9.5,
          font: "Roboto",
        },
        styles: {
          mainHeader: { fontSize: 15, bold: true, margin: [0, 0, 0, 2] },
          subHeader: { fontSize: 11, margin: [0, 0, 0, 10] },
          infoKey: { bold: true, fontSize: 9 },
          infoValue: { fontSize: 9 },
          tableHeader: {
            bold: true,
            fontSize: 8,
            color: "black",
            fillColor: "#E0E0E0",
          }, // Estilo base para cabeçalhos
          tableCell: { fontSize: 7.5 },
          sectionTitle: { fontSize: 9.5, bold: true },
          listText: { fontSize: 8.5, lineHeight: 1.3 },
          baseText: { fontSize: 9.5, lineHeight: 1.3 },
          signatureText: { fontSize: 9.5 },
        },
      };
      pdfMake.createPdf(docDefinition).open();
    });
  }
});
