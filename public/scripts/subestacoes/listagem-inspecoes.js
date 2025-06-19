document.addEventListener("DOMContentLoaded", () => {
  const formFiltrosInspecoes = document.getElementById("formFiltrosInspecoes");
  const filtroInspecaoSubestacaoSelect = document.getElementById(
    "filtroInspecaoSubestacao"
  );
  const filtroInspecaoResponsavelSelect = document.getElementById(
    "filtroInspecaoResponsavel"
  );
  const btnLimparFiltrosInspecoes = document.getElementById(
    "btnLimparFiltrosInspecoes"
  );
  const corpoTabelaInspecoes = document.getElementById("corpoTabelaInspecoes");
  const nenhumaInspecaoMsg = document.getElementById("nenhumaInspecao");

  const modalDetalhesInspecaoEl = document.getElementById(
    "modalDetalhesInspecao"
  );
  const modalDetalhesInspecaoTitulo = document.getElementById(
    "modalDetalhesInspecaoTitulo"
  );
  const corpoModalDetalhesInspecao = document.getElementById(
    "corpoModalDetalhesInspecao"
  );
  const btnGerarPdfInspecaoModal = document.getElementById(
    "btnGerarPdfInspecaoModal"
  );

  const modalAnexosEscritorioEl = document.getElementById(
    "modalAnexosEscritorio"
  );
  const modalAnexosEscritorioTitulo = document.getElementById(
    "modalAnexosEscritorioTitulo"
  );
  const formAnexosEscritorio = document.getElementById("formAnexosEscritorio");
  const inspecaoIdAnexoEscritorioInput = document.getElementById(
    "inspecaoIdAnexoEscritorio"
  );
  const displayInspecaoIdAnexoEscritorio = document.getElementById(
    "displayInspecaoIdAnexoEscritorio"
  );
  const arquivosAnexoEscritorioInput = document.getElementById(
    "arquivosAnexoEscritorio"
  );
  const listaNomesAnexosEscritorio = document.getElementById(
    "listaNomesAnexosEscritorio"
  );
  const descricaoAnexoEscritorioInput = document.getElementById(
    "descricaoAnexoEscritorio"
  );
  const btnSalvarAnexosEscritorio = document.getElementById(
    "btnSalvarAnexosEscritorio"
  );

  const imageLightboxEl = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("lightboxImage");

  const modalConfirmacaoGeralEl = document.getElementById(
    "modalConfirmacaoGeral"
  );
  const modalConfirmacaoGeralTituloTexto = document.getElementById(
    "modalConfirmacaoGeralTituloTexto"
  );
  const modalConfirmacaoGeralIcone = document.getElementById(
    "modalConfirmacaoGeralIcone"
  );
  const mensagemConfirmacaoGeral = document.getElementById(
    "mensagemConfirmacaoGeral"
  );
  const btnConfirmarAcaoGeral = document.getElementById(
    "btnConfirmarAcaoGeral"
  );

  let bsModalDetalhesInspecao = null;
  let bsModalAnexosEscritorio = null;
  let bsModalConfirmacaoGeral = null;
  let bsModalImageLightbox = null;
  let currentInspecaoIdParaPdf = null;

  if (modalDetalhesInspecaoEl)
    bsModalDetalhesInspecao = new bootstrap.Modal(modalDetalhesInspecaoEl);
  if (modalAnexosEscritorioEl)
    bsModalAnexosEscritorio = new bootstrap.Modal(modalAnexosEscritorioEl);
  if (modalConfirmacaoGeralEl)
    bsModalConfirmacaoGeral = new bootstrap.Modal(modalConfirmacaoGeralEl);
  if (imageLightboxEl)
    bsModalImageLightbox = new bootstrap.Modal(imageLightboxEl);

  let idParaAcao = null;
  let callbackAcaoConfirmada = null;

  async function fetchData(url, options = {}) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro HTTP: ${response.status}` }));
        throw new Error(
          errorData.message || `Erro HTTP: ${response.status} em ${url}`
        );
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (error) {
      alert(`Erro ao comunicar com o servidor: ${error.message}`);
      throw error;
    }
  }

  function mostrarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.show();
  }
  function ocultarModal(bsModalInstance) {
    if (bsModalInstance) bsModalInstance.hide();
  }

  function formatarDataSimples(dataISO) {
    if (!dataISO) return "-";
    const dataObj = new Date(
      dataISO.includes("T") ? dataISO : dataISO + "T00:00:00"
    );
    if (isNaN(dataObj.getTime())) return "-";
    return dataObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }

  async function popularFiltroSubestacoes() {
    if (!filtroInspecaoSubestacaoSelect) return;
    try {
      const subestacoes = await fetchData("/subestacoes");
      filtroInspecaoSubestacaoSelect.innerHTML =
        '<option value="">Todas</option>';
      subestacoes.forEach((sub) => {
        const option = document.createElement("option");
        option.value = sub.Id;
        option.textContent = `${sub.sigla} - ${sub.nome}`;
        filtroInspecaoSubestacaoSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao popular filtro de subestações:", error);
    }
  }

  async function popularFiltroResponsaveis() {
    if (!filtroInspecaoResponsavelSelect) return;
    try {
      const usuarios = await fetchData("/usuarios-responsaveis-para-servicos");
      filtroInspecaoResponsavelSelect.innerHTML =
        '<option value="">Todos</option>';
      usuarios.forEach((user) => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.nome;
        filtroInspecaoResponsavelSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Erro ao popular filtro de responsáveis:", error);
    }
  }

  async function carregarInspecoes(params = {}) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    corpoTabelaInspecoes.innerHTML =
      '<tr><td colspan="7" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> Carregando inspeções...</td></tr>';
    nenhumaInspecaoMsg.classList.add("d-none");
    const queryParams = new URLSearchParams();
    for (const key in params) {
      if (params[key]) queryParams.append(key, params[key]);
    }
    const queryString = queryParams.toString();
    const url = `/inspecoes-subestacoes${queryString ? "?" + queryString : ""}`;
    try {
      const inspecoes = await fetchData(url);
      popularTabelaInspecoes(inspecoes);
    } catch (error) {
      corpoTabelaInspecoes.innerHTML =
        '<tr><td colspan="7" class="text-center text-danger p-5">Erro ao carregar inspeções.</td></tr>';
    }
  }

  function popularTabelaInspecoes(inspecoes) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    corpoTabelaInspecoes.innerHTML = "";
    if (!inspecoes || inspecoes.length === 0) {
      nenhumaInspecaoMsg.classList.remove("d-none");
      return;
    }
    nenhumaInspecaoMsg.classList.add("d-none");
    inspecoes.forEach((insp) => {
      const tr = document.createElement("tr");
      const dataAvaliacaoFormatada = formatarDataSimples(insp.data_avaliacao);
      const statusInsp = insp.status_inspecao?.toUpperCase();
      const podeConcluir =
        statusInsp === "EM_ANDAMENTO" || statusInsp === "PENDENTE_REVISAO";
      const podeRecuperar =
        statusInsp === "CONCLUIDA" || statusInsp === "CANCELADA";
      const formNumId = insp.formulario_inspecao_num || insp.id;
      const statusClasseBase = (
        insp.status_inspecao || "desconhecido"
      ).toLowerCase();
      const statusClasseFinal = statusClasseBase
        .replace(/\s+/g, "_")
        .replace(/-/g, "_");
      const statusTextoDisplay = (
        insp.status_inspecao || "DESCONHECIDO"
      ).replace("_", " ");
      let btnConcluirHtml = `<button class="btn btn-icon text-muted" title="Inspeção não pode ser concluída" disabled><span class="material-symbols-outlined">task_alt</span></button>`;
      if (podeConcluir)
        btnConcluirHtml = `<button class="btn btn-icon text-success btn-concluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Concluir Inspeção"><span class="material-symbols-outlined">task_alt</span></button>`;
      let btnRecoveryHtml = `<button class="btn btn-icon text-muted" title="Inspeção não pode ser reaberta" disabled><span class="material-symbols-outlined">history</span></button>`;
      if (podeRecuperar)
        btnRecoveryHtml = `<button class="btn btn-icon text-warning btn-recovery-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Reabrir Inspeção"><span class="material-symbols-outlined">history</span></button>`;
      let btnExcluirHtml = `<button class="btn btn-icon text-danger btn-excluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Excluir Inspeção"><span class="material-symbols-outlined">delete</span></button>`;

      tr.innerHTML = `
        <td class="text-center">${formNumId}</td>
        <td>${insp.subestacao_sigla}</td>
        <td class="text-center">${dataAvaliacaoFormatada}</td>
        <td>${insp.responsavel_nome}</td>
        <td class="text-center"><span class="status-badge status-${statusClasseFinal}">${statusTextoDisplay}</span></td>
        <td class="text-center actions-column">
            <button class="btn btn-icon text-info btn-ver-detalhes-inspecao" data-id="${insp.id}" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
            <button class="btn btn-icon text-secondary btn-gerar-pdf-inspecao" data-id="${insp.id}" title="Gerar PDF"><span class="material-symbols-outlined">picture_as_pdf</span></button>
            <button class="btn btn-icon text-primary btn-anexar-escritorio" data-id="${insp.id}" title="Anexar Documentos"><span class="material-symbols-outlined">attach_file</span></button>
            ${btnConcluirHtml}
            ${btnRecoveryHtml}
            ${btnExcluirHtml}
        </td>`;
      tr.querySelector(".btn-ver-detalhes-inspecao")?.addEventListener(
        "click",
        () => abrirModalDetalhesInspecao(insp.id)
      );
      tr.querySelector(".btn-gerar-pdf-inspecao")?.addEventListener(
        "click",
        () => gerarPdfInspecao(insp.id)
      );
      tr.querySelector(".btn-anexar-escritorio")?.addEventListener(
        "click",
        () => abrirModalAnexosEscritorio(insp.id)
      );
      tr.querySelector(".btn-concluir-inspecao")?.addEventListener(
        "click",
        (e) =>
          abrirModalConfirmacao(
            "concluir",
            e.currentTarget.dataset.id,
            `#${e.currentTarget.dataset.formNum}`,
            "task_alt",
            "success"
          )
      );
      tr.querySelector(".btn-recovery-inspecao")?.addEventListener(
        "click",
        (e) =>
          abrirModalConfirmacao(
            "reabrir",
            e.currentTarget.dataset.id,
            `#${e.currentTarget.dataset.formNum}`,
            "history",
            "warning"
          )
      );
      tr.querySelector(".btn-excluir-inspecao")?.addEventListener(
        "click",
        (e) =>
          abrirModalConfirmacao(
            "excluir",
            e.currentTarget.dataset.id,
            `#${e.currentTarget.dataset.formNum}`,
            "delete",
            "danger"
          )
      );
      corpoTabelaInspecoes.appendChild(tr);
    });
  }

  function gerarPdfInspecao(inspecaoId) {
    if (inspecaoId) {
      window.open(`/inspecoes-subestacoes/${inspecaoId}/pdf`, "_blank");
    } else {
      alert("ID da inspeção não encontrado para gerar o PDF.");
    }
  }

  if (btnGerarPdfInspecaoModal) {
    btnGerarPdfInspecaoModal.addEventListener("click", () => {
      if (currentInspecaoIdParaPdf) {
        gerarPdfInspecao(currentInspecaoIdParaPdf);
      } else {
        alert(
          "Não foi possível identificar a inspeção para gerar o PDF a partir do modal."
        );
      }
    });
  }

  function abrirModalConfirmacao(
    tipoAcao,
    id,
    formNumReferencia,
    icone,
    classeBtnContextual
  ) {
    idParaAcao = id;
    const acaoCapitalizada =
      tipoAcao.charAt(0).toUpperCase() + tipoAcao.slice(1);
    if (modalConfirmacaoGeralTituloTexto)
      modalConfirmacaoGeralTituloTexto.textContent = `${acaoCapitalizada} Inspeção`;
    if (modalConfirmacaoGeralIcone) {
      modalConfirmacaoGeralIcone.textContent = icone;
      modalConfirmacaoGeralIcone.className = `material-symbols-outlined me-2 text-${classeBtnContextual}`;
    }
    if (mensagemConfirmacaoGeral)
      mensagemConfirmacaoGeral.textContent = `Tem certeza que deseja ${tipoAcao.toLowerCase()} a Inspeção ${formNumReferencia}?`;
    if (btnConfirmarAcaoGeral) {
      btnConfirmarAcaoGeral.className = `btn btn-sm btn-${classeBtnContextual}`;
      btnConfirmarAcaoGeral.innerHTML = `<span class="material-symbols-outlined">${icone}</span> Confirmar ${acaoCapitalizada}`;
    }
    if (tipoAcao === "concluir")
      callbackAcaoConfirmada = handleConcluirInspecao;
    else if (tipoAcao === "reabrir")
      callbackAcaoConfirmada = handleReabrirInspecao;
    else if (tipoAcao === "excluir")
      callbackAcaoConfirmada = handleExcluirInspecao;
    else callbackAcaoConfirmada = null;
    if (bsModalConfirmacaoGeral) mostrarModal(bsModalConfirmacaoGeral);
  }

  async function handleConcluirInspecao() {
    if (!idParaAcao) return;
    await executarAcaoInspecao(idParaAcao, "concluir", "Concluindo...");
  }
  async function handleReabrirInspecao() {
    if (!idParaAcao) return;
    await executarAcaoInspecao(idParaAcao, "reabrir", "Reabrindo...");
  }
  async function handleExcluirInspecao() {
    if (!idParaAcao) return;
    await executarAcaoInspecao(idParaAcao, "excluir", "Excluindo...", "DELETE");
  }

  async function executarAcaoInspecao(
    id,
    acao,
    mensagemCarregando,
    metodoHttp = "PUT"
  ) {
    if (!btnConfirmarAcaoGeral) return;
    const originalButtonHtml = btnConfirmarAcaoGeral.innerHTML;
    btnConfirmarAcaoGeral.disabled = true;
    btnConfirmarAcaoGeral.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${mensagemCarregando}`;
    try {
      const url =
        acao === "excluir"
          ? `/inspecoes-subestacoes/${id}`
          : `/inspecoes-subestacoes/${id}/${acao}`;
      const response = await fetch(url, {
        method: metodoHttp,
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: `Erro ao ${acao} inspeção.` }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || `Inspeção ${acao} com sucesso!`);
      if (bsModalConfirmacaoGeral) ocultarModal(bsModalConfirmacaoGeral);
      const formData = formFiltrosInspecoes
        ? new FormData(formFiltrosInspecoes)
        : new FormData();
      carregarInspecoes(Object.fromEntries(formData.entries()));
    } catch (error) {
      alert(`Falha ao ${acao} inspeção: ${error.message}`);
    } finally {
      btnConfirmarAcaoGeral.disabled = false;
      btnConfirmarAcaoGeral.innerHTML = originalButtonHtml;
      idParaAcao = null;
      callbackAcaoConfirmada = null;
    }
  }

  if (btnConfirmarAcaoGeral && bsModalConfirmacaoGeral) {
    btnConfirmarAcaoGeral.addEventListener("click", () => {
      if (typeof callbackAcaoConfirmada === "function")
        callbackAcaoConfirmada();
    });
  }

  function openImageLightbox(imageUrl) {
    if (lightboxImage && bsModalImageLightbox) {
      lightboxImage.src = imageUrl;
      mostrarModal(bsModalImageLightbox);
    }
  }

  async function abrirModalDetalhesInspecao(inspecaoId) {
    if (
      !corpoModalDetalhesInspecao ||
      !bsModalDetalhesInspecao ||
      !modalDetalhesInspecaoTitulo
    )
      return;
    currentInspecaoIdParaPdf = inspecaoId;
    corpoModalDetalhesInspecao.innerHTML =
      '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div> <p class="mt-2">Carregando detalhes...</p></div>';
    mostrarModal(bsModalDetalhesInspecao);
    try {
      const inspecao = await fetchData(`/inspecoes-subestacoes/${inspecaoId}`);
      modalDetalhesInspecaoTitulo.innerHTML = `<span class="material-symbols-outlined me-2">plagiarism</span> Detalhes Inspeção #${
        inspecao.formulario_inspecao_num || inspecao.id
      } (${inspecao.subestacao_sigla})`;
      const statusClasseBaseModal = (
        inspecao.status_inspecao || "desconhecido"
      ).toLowerCase();
      const statusClasseFinalModal = statusClasseBaseModal
        .replace(/\s+/g, "_")
        .replace(/-/g, "_");
      const statusTextoDisplayModal = (
        inspecao.status_inspecao || "DESCONHECIDO"
      ).replace("_", " ");

      let htmlDetalhes = `
        <div class="detalhes-cabecalho mb-3">
            <div class="row gx-3 gy-2">
                <div class="col-md-6"><strong>Nº Formulário:</strong> ${
                  inspecao.formulario_inspecao_num || inspecao.id
                }</div>
                <div class="col-md-6"><strong>Subestação:</strong> ${
                  inspecao.subestacao_sigla
                } - ${inspecao.subestacao_nome}</div>
                <div class="col-md-6"><strong>Responsável:</strong> ${
                  inspecao.responsavel_nome
                }</div>
                <div class="col-md-6"><strong>Data Avaliação:</strong> ${
                  inspecao.data_avaliacao_fmt ||
                  formatarDataSimples(inspecao.data_avaliacao)
                }</div>
                <div class="col-md-6"><strong>Horário:</strong> ${inspecao.hora_inicial.substring(
                  0,
                  5
                )} ${
        inspecao.hora_final ? " às " + inspecao.hora_final.substring(0, 5) : ""
      }</div>
                <div class="col-md-6"><strong>Status:</strong> <span class="status-badge status-${statusClasseFinalModal}">${statusTextoDisplayModal}</span></div>
            </div>
        </div>`;

      if (inspecao.medicoes && inspecao.medicoes.length > 0) {
        htmlDetalhes += "<hr><h4>Medições de Equipamentos Registradas:</h4>";
        htmlDetalhes += '<div class="medicoes-registradas-container mb-3">';
        inspecao.medicoes.forEach((med) => {
          let tipoMedicaoDisplay = med.tipo_medicao.replace(/_/g, " ");
          if (med.tipo_medicao === "TEMPERATURA_TRAFO")
            tipoMedicaoDisplay = "Temperatura Trafo";
          else if (med.tipo_medicao === "CONTADOR_RELIGADOR")
            tipoMedicaoDisplay = "Contador Religador";
          else if (med.tipo_medicao === "BATERIA_MONITOR")
            tipoMedicaoDisplay = "Bateria Monitor";
          else if (med.tipo_medicao === "TEMPERATURA_OLEO")
            tipoMedicaoDisplay = "Temperatura Óleo";
          else if (med.tipo_medicao === "TEMPERATURA_ENROLAMENTO")
            tipoMedicaoDisplay = "Temperatura Enrolamento";
          else if (med.tipo_medicao === "NIVEL_OLEO")
            tipoMedicaoDisplay = "Nível Óleo";
          htmlDetalhes += `<div class="medicao-registrada-item alert alert-light py-2 px-3 mb-2">`;
          htmlDetalhes += `<strong>Tipo:</strong> ${tipoMedicaoDisplay}`;
          if (med.tag_equipamento)
            htmlDetalhes += ` | <strong>TAG Equip.:</strong> ${med.tag_equipamento}`;
          htmlDetalhes += ` | <strong>Valor:</strong> ${
            med.valor_medido_texto || med.valor_medido_numerico || "-"
          }`;
          if (med.unidade_medida) htmlDetalhes += ` ${med.unidade_medida}`;
          if (med.observacao)
            htmlDetalhes += `<br><small class="text-muted"><em>Obs: ${med.observacao}</em></small>`;
          if (med.anexos_medicao && med.anexos_medicao.length > 0) {
            htmlDetalhes += `<div class="anexos-sub-item-container mt-2">`;
            med.anexos_medicao.forEach((anexoMed) => {
              htmlDetalhes += `<div class="anexo-item-detalhes d-inline-block me-2 mb-2"> <img src="${anexoMed.caminho_servidor}" alt="Evidência medição" class="anexo-foto-item anexo-foto-medicao" data-src="${anexoMed.caminho_servidor}"></div>`;
            });
            htmlDetalhes += `</div>`;
          }
          htmlDetalhes += `</div>`;
        });
        htmlDetalhes += "</div>";
      }

      if (
        inspecao.equipamentos_observados &&
        inspecao.equipamentos_observados.length > 0
      ) {
        htmlDetalhes += "<hr><h4>Equipamentos Observados/Inspecionados:</h4>";
        htmlDetalhes += '<div class="equipamentos-observados-container mb-3">';
        inspecao.equipamentos_observados.forEach((equip) => {
          htmlDetalhes += `<div class="equipamento-observado-item alert alert-light py-2 px-3 mb-2">`;
          htmlDetalhes += `<strong>Tipo:</strong> ${equip.tipo_equipamento}`;
          if (equip.tag_equipamento)
            htmlDetalhes += ` | <strong>TAG:</strong> ${equip.tag_equipamento}`;
          if (equip.observacao)
            htmlDetalhes += `<br><small class="text-muted"><em>Obs: ${equip.observacao}</em></small>`;
          if (equip.anexos_equip_obs && equip.anexos_equip_obs.length > 0) {
            htmlDetalhes += `<div class="anexos-sub-item-container mt-2">`;
            equip.anexos_equip_obs.forEach((anexoEq) => {
              htmlDetalhes += `<div class="anexo-item-detalhes d-inline-block me-2 mb-2"> <img src="${
                anexoEq.caminho_servidor
              }" alt="Foto Equipamento ${
                equip.tag_equipamento || equip.tipo_equipamento
              }" class="anexo-foto-item anexo-foto-equip-obs" data-src="${
                anexoEq.caminho_servidor
              }"></div>`;
            });
            htmlDetalhes += `</div>`;
          }
          htmlDetalhes += `</div>`;
        });
        htmlDetalhes += "</div>";
      }

      if (
        inspecao.verificacoes_adicionais &&
        inspecao.verificacoes_adicionais.length > 0
      ) {
        htmlDetalhes += "<hr><h4>Pontos de Verificação Adicionais:</h4>";
        htmlDetalhes += '<div class="verificacoes-adicionais-container mb-3">';
        inspecao.verificacoes_adicionais.forEach((verif) => {
          htmlDetalhes += `<div class="verificacao-adicional-item alert alert-light py-2 px-3 mb-2">`;
          htmlDetalhes += `<strong>Item Verificado:</strong> ${verif.item_verificado}`;
          htmlDetalhes += ` | <strong>Estado:</strong> ${verif.estado_item}`;
          if (verif.num_formulario_referencia)
            htmlDetalhes += ` | <strong>Form. Ref.:</strong> ${verif.num_formulario_referencia}`;
          if (verif.detalhes_observacao)
            htmlDetalhes += `<br><small class="text-muted"><em>Detalhes: ${verif.detalhes_observacao}</em></small>`;
          htmlDetalhes += `</div>`;
        });
        htmlDetalhes += "</div>";
      }

      if (
        inspecao.gruposDeItens &&
        Object.keys(inspecao.gruposDeItens).length > 0
      ) {
        htmlDetalhes += "<hr><h4>Itens do Checklist:</h4>";
        for (const grupoNome in inspecao.gruposDeItens) {
          htmlDetalhes += `<div class="checklist-grupo-detalhes mb-3"><h5>${grupoNome}</h5><ul class="list-unstyled">`;
          inspecao.gruposDeItens[grupoNome].forEach((item) => {
            htmlDetalhes += `<li class="pb-2 mb-2 border-bottom"><strong>${
              item.num
            }. ${
              item.desc
            }</strong><br> Avaliação: <span class="avaliacao-${item.avaliacao.toLowerCase()}">${
              item.avaliacao
            }</span> ${
              item.obs ? `<br><em class="text-muted">Obs: ${item.obs}</em>` : ""
            }`;
            if (item.anexos && item.anexos.length > 0) {
              htmlDetalhes += `<div class="anexos-sub-item-container mt-2">`;
              item.anexos.forEach((anexo) => {
                htmlDetalhes += `<div class="anexo-item-detalhes d-inline-block me-2 mb-2"> <img src="${anexo.caminho}" alt="Evidência item ${item.num}" class="anexo-foto-item anexo-foto-checklist-item" data-src="${anexo.caminho}"></div>`;
              });
              htmlDetalhes += `</div>`;
            }
            htmlDetalhes += `</li>`;
          });
          htmlDetalhes += "</ul></div>";
        }
      } else {
        htmlDetalhes +=
          "<hr><p>Nenhum item de checklist registrado para esta inspeção.</p>";
      }

      if (inspecao.observacoes_gerais) {
        htmlDetalhes += `<hr><h4>Observações Gerais (Campo Livre):</h4><p class="obs-gerais alert alert-secondary">${inspecao.observacoes_gerais}</p>`;
      }

      if (inspecao.anexosGerais && inspecao.anexosGerais.length > 0) {
        htmlDetalhes += `<hr><h4>Anexos Gerais e de Escritório:</h4><div class="anexos-detalhes-container row g-2">`;
        inspecao.anexosGerais.forEach((anexo) => {
          let icon = "description";
          if (anexo.categoria === "DOCUMENTO_ESCRITORIO")
            icon = "business_center";
          else if (anexo.caminho.match(/\.(jpg|jpeg|png|gif|heic|heif)$/i))
            icon = "image";
          else if (anexo.caminho.match(/\.(pdf)$/i)) icon = "picture_as_pdf";
          else if (anexo.caminho.match(/\.(doc|docx)$/i)) icon = "article";
          else if (anexo.caminho.match(/\.(xls|xlsx|csv)$/i))
            icon = "assessment";
          htmlDetalhes += `<div class="col-md-6"><div class="anexo-item-detalhes"> <span class="material-symbols-outlined">${icon}</span> <div class="anexo-info"> <a href="${
            anexo.caminho
          }" target="_blank">${
            anexo.nome
          }</a> <span class="anexo-categoria d-block text-muted" title="${
            anexo.descricao || ""
          }">${anexo.categoria.replace(/_/g, " ")}</span> ${
            anexo.descricao
              ? `<span class="anexo-descricao d-block text-muted">${anexo.descricao}</span>`
              : ""
          } </div> </div></div>`;
        });
        htmlDetalhes += "</div>";
      }
      corpoModalDetalhesInspecao.innerHTML = htmlDetalhes;
      corpoModalDetalhesInspecao
        .querySelectorAll(".anexo-foto-item")
        .forEach((img) => {
          img.addEventListener("click", () =>
            openImageLightbox(img.dataset.src)
          );
        });
    } catch (error) {
      corpoModalDetalhesInspecao.innerHTML =
        '<p class="text-center text-danger p-5">Erro ao carregar detalhes da inspeção.</p>';
      console.error("Erro ao abrir modal de detalhes:", error);
    }
  }

  function abrirModalAnexosEscritorio(inspecaoId) {
    if (
      !formAnexosEscritorio ||
      !inspecaoIdAnexoEscritorioInput ||
      !displayInspecaoIdAnexoEscritorio ||
      !modalAnexosEscritorioTitulo ||
      !listaNomesAnexosEscritorio ||
      !bsModalAnexosEscritorio
    )
      return;
    formAnexosEscritorio.reset();
    inspecaoIdAnexoEscritorioInput.value = inspecaoId;
    displayInspecaoIdAnexoEscritorio.textContent = inspecaoId;
    modalAnexosEscritorioTitulo.innerHTML = `<span class="material-symbols-outlined me-2">upload_file</span> Anexar Documentos (Inspeção ID: ${inspecaoId})`;
    listaNomesAnexosEscritorio.innerHTML = "";
    mostrarModal(bsModalAnexosEscritorio);
  }

  if (arquivosAnexoEscritorioInput && listaNomesAnexosEscritorio) {
    arquivosAnexoEscritorioInput.addEventListener("change", () => {
      listaNomesAnexosEscritorio.innerHTML = "";
      if (arquivosAnexoEscritorioInput.files.length > 0) {
        for (const file of arquivosAnexoEscritorioInput.files) {
          const li = document.createElement("li");
          li.className =
            "list-group-item d-flex justify-content-between align-items-center py-1";
          li.innerHTML = `<div><span class="material-symbols-outlined me-2 align-middle">draft</span> ${
            file.name
          }</div> <small class="text-muted">${(file.size / 1024).toFixed(
            1
          )} KB</small>`;
          listaNomesAnexosEscritorio.appendChild(li);
        }
      }
    });
  }

  if (
    btnSalvarAnexosEscritorio &&
    inspecaoIdAnexoEscritorioInput &&
    arquivosAnexoEscritorioInput &&
    descricaoAnexoEscritorioInput &&
    bsModalAnexosEscritorio
  ) {
    btnSalvarAnexosEscritorio.addEventListener("click", async () => {
      const inspecaoId = inspecaoIdAnexoEscritorioInput.value;
      const files = arquivosAnexoEscritorioInput.files;
      const descricao = descricaoAnexoEscritorioInput.value.trim();
      if (!inspecaoId) {
        alert("ID da Inspeção não encontrado.");
        return;
      }
      if (files.length === 0) {
        alert("Selecione pelo menos um arquivo para anexar.");
        return;
      }
      if (files.length > 5) {
        alert("Você pode anexar no máximo 5 arquivos por vez.");
        return;
      }
      const formData = new FormData();
      for (let i = 0; i < files.length; i++)
        formData.append("anexosEscritorio", files[i]);
      if (descricao) formData.append("descricao_anexo_escritorio", descricao);
      const originalButtonHtml = btnSalvarAnexosEscritorio.innerHTML;
      btnSalvarAnexosEscritorio.disabled = true;
      btnSalvarAnexosEscritorio.innerHTML =
        '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
      try {
        const response = await fetch(
          `/inspecoes-subestacoes/${inspecaoId}/anexos-escritorio`,
          { method: "POST", body: formData }
        );
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro ao salvar anexos." }));
          throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
        }
        const result = await response.json();
        alert(result.message || "Anexos salvos com sucesso!");
        ocultarModal(bsModalAnexosEscritorio);
        const currentFormData = formFiltrosInspecoes
          ? new FormData(formFiltrosInspecoes)
          : new FormData();
        carregarInspecoes(Object.fromEntries(currentFormData.entries()));
      } catch (error) {
        alert(`Falha ao salvar anexos: ${error.message}`);
      } finally {
        btnSalvarAnexosEscritorio.disabled = false;
        btnSalvarAnexosEscritorio.innerHTML = originalButtonHtml;
      }
    });
  }

  if (formFiltrosInspecoes) {
    formFiltrosInspecoes.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(formFiltrosInspecoes);
      const params = Object.fromEntries(formData.entries());
      carregarInspecoes(params);
    });
  }

  if (btnLimparFiltrosInspecoes) {
    btnLimparFiltrosInspecoes.addEventListener("click", () => {
      if (formFiltrosInspecoes) formFiltrosInspecoes.reset();
      carregarInspecoes();
    });
  }

  function init() {
    popularFiltroSubestacoes();
    popularFiltroResponsaveis();
    carregarInspecoes();
  }
  init();
});
