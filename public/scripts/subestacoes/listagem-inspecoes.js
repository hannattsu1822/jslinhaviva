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

  const modalAnexosEscritorioEl = document.getElementById(
    "modalAnexosEscritorio"
  );
  const modalConfirmacaoGeralEl = document.getElementById(
    "modalConfirmacaoGeral"
  );

  const formAnexosEscritorio = document.getElementById("formAnexosEscritorio");
  const inspecaoIdAnexoEscritorioInput = document.getElementById(
    "inspecaoIdAnexoEscritorio"
  );
  const displayInspecaoIdAnexoEscritorio = document.getElementById(
    "displayInspecaoIdAnexoEscritorio"
  );
  const btnAdicionarAnexoEscritorio = document.getElementById(
    "btnAdicionarAnexoEscritorio"
  );
  const arquivosAnexoEscritorioInput = document.getElementById(
    "arquivosAnexoEscritorio"
  );
  const previewAnexosEscritorio = document.getElementById(
    "previewAnexosEscritorio"
  );
  const templateAnexoPreview = document.getElementById("templateAnexoPreview");
  const descricaoAnexoEscritorioInput = document.getElementById(
    "descricaoAnexoEscritorio"
  );
  const btnSalvarAnexosEscritorio = document.getElementById(
    "btnSalvarAnexosEscritorio"
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

  const modalAnexarAPREl = document.getElementById("modalAnexarAPRInspecao");
  const formAnexarAPR = document.getElementById("formAnexarAPRInspecao");
  const inspecaoIdAnexoAPRInput = document.getElementById("inspecaoIdAnexoAPR");
  const formNumInspecaoAnexoAPRSpan = document.getElementById(
    "formNumInspecaoAnexoAPR"
  );
  const btnAdicionarAnexoAPR = document.getElementById(
    "btnAdicionarAnexoAPRInspecao"
  );
  const arquivosAnexoAPRInput = document.getElementById(
    "arquivosAnexoAPRInspecao"
  );
  const previewAnexosAPRDiv = document.getElementById(
    "previewAnexosAPRInspecao"
  );
  const templateAnexoPreviewAPR = document.getElementById(
    "templateAnexoPreviewAPR"
  );

  const modalVerAPRsEl = document.getElementById("modalVerAPRsInspecao");
  const formNumInspecaoVerAPRSpan = document.getElementById(
    "formNumInspecaoVerAPR"
  );
  const listaAPRsAnexadasUl = document.getElementById(
    "listaAPRsAnexadasInspecao"
  );

  const paginationContainer = document.getElementById("paginationContainer");
  let currentPage = 1;
  const a_cada = 10;

  let idParaAcao = null;
  let callbackAcaoConfirmada = null;
  let filesToUpload = [];
  let anexosAPRTemporarios = [];

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append("anexo", file);

    try {
      const response = await fetch("/api/inspecoes/upload-temporario", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Erro de comunicação com o servidor." }));
        throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Falha no upload:", error);
      throw error;
    }
  }

  function showModal(modalEl) {
    if (modalEl) {
      modalEl.style.display = "flex";
      setTimeout(() => modalEl.classList.add("show"), 10);
    }
  }

  function hideModal(modalEl) {
    if (modalEl) {
      modalEl.classList.remove("show");
      setTimeout(() => (modalEl.style.display = "none"), 200);
    }
  }

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideModal(modal);
      }
    });
    modal.querySelectorAll(".btn-close, .btn-close-modal").forEach((btn) => {
      btn.addEventListener("click", () => hideModal(modal));
    });
  });

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

  async function carregarInspecoes(page = 1) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    currentPage = page;
    corpoTabelaInspecoes.innerHTML =
      '<tr><td colspan="10" style="text-align: center; padding: 2rem;">Carregando inspeções...</td></tr>';
    nenhumaInspecaoMsg.style.display = "none";

    const params = Object.fromEntries(
      new FormData(formFiltrosInspecoes).entries()
    );
    params.page = currentPage;
    params.limit = a_cada;

    const queryParams = new URLSearchParams(params);
    const url = `/inspecoes-subestacoes?${queryParams.toString()}`;

    try {
      const response = await fetchData(url);
      popularTabelaInspecoes(response.data);
      renderizarPaginacao(response.total, response.page, response.totalPages);
    } catch (error) {
      corpoTabelaInspecoes.innerHTML =
        '<tr><td colspan="10" style="text-align: center; color: red; padding: 2rem;">Erro ao carregar inspeções.</td></tr>';
      if (paginationContainer) paginationContainer.innerHTML = "";
    }
  }

  function renderizarPaginacao(totalItems, page, totalPages) {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
      const pageButton = document.createElement("button");
      pageButton.textContent = i;
      pageButton.className = "pagination-button";
      if (i === page) {
        pageButton.classList.add("active");
        pageButton.disabled = true;
      }
      pageButton.addEventListener("click", () => {
        carregarInspecoes(i);
      });
      paginationContainer.appendChild(pageButton);
    }
  }

  function popularTabelaInspecoes(inspecoes) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    corpoTabelaInspecoes.innerHTML = "";
    if (!inspecoes || inspecoes.length === 0) {
      nenhumaInspecaoMsg.style.display = "block";
      return;
    }
    nenhumaInspecaoMsg.style.display = "none";

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
      const statusClasseFinal = statusClasseBase.replace(/ /g, "_");
      const statusTextoDisplay = (
        insp.status_inspecao || "DESCONHECIDO"
      ).replace(/_/g, " ");

      const tipoFormatado = (insp.tipo_inspecao || "N/A").replace(/_/g, " ");
      const modoFormatado = (insp.modo_inspecao || "CHECKLIST").replace(
        "CHECKLIST",
        "Padrão"
      );

      let btnConcluirHtml = `<button class="btn" title="Inspeção não pode ser concluída" disabled><span class="material-symbols-outlined">task_alt</span></button>`;
      if (podeConcluir) {
        btnConcluirHtml = `<button class="btn text-success btn-concluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Concluir Inspeção"><span class="material-symbols-outlined">task_alt</span></button>`;
      }

      let btnRecoveryHtml = `<button class="btn" title="Inspeção não pode ser reaberta" disabled><span class="material-symbols-outlined">history</span></button>`;
      if (podeRecuperar) {
        btnRecoveryHtml = `<button class="btn text-warning btn-recovery-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Reabrir Inspeção"><span class="material-symbols-outlined">history</span></button>`;
      }

      let btnExcluirHtml = `<button class="btn text-danger btn-excluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Excluir Inspeção"><span class="material-symbols-outlined">delete</span></button>`;

      const aprAnexos = insp.apr_anexos ? JSON.parse(insp.apr_anexos) : [];
      const aprCount = insp.apr_count || 0;

      let aprButtonHtml = "";
      if (aprCount > 0) {
        aprButtonHtml = `<button class="btn btn-sm btn-success btn-ver-apr" data-form-num="${formNumId}" data-anexos='${JSON.stringify(
          aprAnexos
        )}' title="Ver APRs Anexadas"><span class="material-symbols-outlined">visibility</span> APR (${aprCount})</button>`;
      } else {
        aprButtonHtml = `<button class="btn btn-sm btn-primary btn-anexar-apr" data-id="${insp.id}" data-form-num="${formNumId}" title="Anexar APR"><span class="material-symbols-outlined">upload_file</span> APR</button>`;
      }

      tr.innerHTML = `
        <td class="text-center">${formNumId}</td>
        <td>${insp.processo || "-"}</td>
        <td>${insp.subestacao_sigla}</td>
        <td>${modoFormatado}</td>
        <td>${tipoFormatado}</td>
        <td class="text-center">${dataAvaliacaoFormatada}</td>
        <td>${insp.responsavel_nome}</td>
        <td class="text-center"><span class="status-badge status-${statusClasseFinal}">${statusTextoDisplay}</span></td>
        <td class="text-center">${aprButtonHtml}</td>
        <td class="actions-column">
            <button class="btn text-info btn-ver-detalhes-inspecao" data-id="${
              insp.id
            }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
            <button class="btn text-primary btn-editar-inspecao" data-id="${
              insp.id
            }" title="Editar Inspeção"><span class="material-symbols-outlined">edit</span></button>
            <button class="btn text-secondary btn-anexar-escritorio" data-id="${
              insp.id
            }" title="Anexar Documentos"><span class="material-symbols-outlined">attach_file</span></button>
            ${btnConcluirHtml}
            ${btnRecoveryHtml}
            ${btnExcluirHtml}
        </td>`;

      tr.querySelector(".btn-ver-detalhes-inspecao")?.addEventListener(
        "click",
        () => {
          window.location.href = `/inspecoes-subestacoes/detalhes/${insp.id}`;
        }
      );
      tr.querySelector(".btn-editar-inspecao")?.addEventListener(
        "click",
        () => {
          window.location.href = `/pagina-checklist-inspecao-subestacao?editarId=${insp.id}`;
        }
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
      tr.querySelector(".btn-anexar-apr")?.addEventListener("click", (e) =>
        abrirModalAnexarAPR(
          e.currentTarget.dataset.id,
          e.currentTarget.dataset.formNum
        )
      );
      tr.querySelector(".btn-ver-apr")?.addEventListener("click", (e) => {
        const anexosData = e.currentTarget.dataset.anexos;
        const anexosArray = anexosData ? JSON.parse(anexosData) : [];
        abrirModalVerAPRs(e.currentTarget.dataset.formNum, anexosArray);
      });
      corpoTabelaInspecoes.appendChild(tr);
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
      modalConfirmacaoGeralIcone.style.color = `var(--c-${classeBtnContextual})`;
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

    showModal(modalConfirmacaoGeralEl);
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
    btnConfirmarAcaoGeral.innerHTML = `Salvando...`;
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
      hideModal(modalConfirmacaoGeralEl);
      carregarInspecoes(currentPage);
    } catch (error) {
      alert(`Falha ao ${acao} inspeção: ${error.message}`);
    } finally {
      btnConfirmarAcaoGeral.disabled = false;
      btnConfirmarAcaoGeral.innerHTML = originalButtonHtml;
      idParaAcao = null;
      callbackAcaoConfirmada = null;
    }
  }

  if (btnConfirmarAcaoGeral) {
    btnConfirmarAcaoGeral.addEventListener("click", () => {
      if (typeof callbackAcaoConfirmada === "function") {
        callbackAcaoConfirmada();
      }
    });
  }

  function abrirModalAnexosEscritorio(inspecaoId) {
    if (!formAnexosEscritorio || !inspecaoIdAnexoEscritorioInput) return;
    formAnexosEscritorio.reset();
    filesToUpload = [];
    renderAnexoPreviews();
    inspecaoIdAnexoEscritorioInput.value = inspecaoId;
    displayInspecaoIdAnexoEscritorio.textContent = inspecaoId;
    showModal(modalAnexosEscritorioEl);
  }

  function renderAnexoPreviews() {
    if (!previewAnexosEscritorio || !templateAnexoPreview) return;
    previewAnexosEscritorio.innerHTML = "";
    filesToUpload.forEach((anexo, index) => {
      const previewClone = templateAnexoPreview.content.cloneNode(true);
      const previewItem = previewClone.querySelector(".anexo-preview-item");
      const imgPreview = previewClone.querySelector(".anexo-preview-img");
      const iconDefault = previewClone.querySelector(
        ".anexo-preview-icon-default"
      );
      const previewName = previewClone.querySelector(".anexo-name");
      const previewSize = previewClone.querySelector(".anexo-size");
      const removeBtn = previewClone.querySelector(".btn-remover-anexo");
      const statusContainer = document.createElement("div");
      statusContainer.className = "anexo-status";
      previewItem.appendChild(statusContainer);

      previewName.textContent = anexo.originalName;
      previewSize.textContent = `${(anexo.file.size / 1024).toFixed(1)} KB`;

      if (anexo.file.type.startsWith("image/")) {
        imgPreview.src = anexo.previewUrl;
        imgPreview.classList.remove("visually-hidden");
        iconDefault.classList.add("visually-hidden");
      } else {
        imgPreview.classList.add("visually-hidden");
        iconDefault.classList.remove("visually-hidden");
      }

      if (anexo.status === "uploading") {
        statusContainer.innerHTML = '<div class="loading-spinner-small"></div>';
        removeBtn.disabled = true;
      } else if (anexo.status === "error") {
        statusContainer.textContent = "Falha";
        statusContainer.style.color = "red";
        removeBtn.disabled = false;
      } else if (anexo.status === "uploaded") {
        statusContainer.textContent = "Concluído";
        statusContainer.style.color = "green";
        removeBtn.disabled = false;
      }

      removeBtn.addEventListener("click", () => {
        filesToUpload.splice(index, 1);
        renderAnexoPreviews();
      });

      previewAnexosEscritorio.appendChild(previewClone);
    });
  }

  if (btnAdicionarAnexoEscritorio) {
    btnAdicionarAnexoEscritorio.addEventListener("click", () => {
      arquivosAnexoEscritorioInput.click();
    });
  }

  if (arquivosAnexoEscritorioInput) {
    arquivosAnexoEscritorioInput.addEventListener("change", async (event) => {
      const newFiles = Array.from(event.target.files);
      if (filesToUpload.length + newFiles.length > 5) {
        alert("Você pode anexar no máximo 5 arquivos por vez.");
        event.target.value = null;
        return;
      }

      const newAttachments = newFiles.map((file) => ({
        file: file,
        originalName: file.name,
        previewUrl: URL.createObjectURL(file),
        status: "uploading",
      }));

      filesToUpload.push(...newAttachments);
      renderAnexoPreviews();
      event.target.value = null;

      for (const anexo of newAttachments) {
        try {
          const result = await uploadFile(anexo.file);
          anexo.status = "uploaded";
          anexo.tempFileName = result.tempFileName;
        } catch (error) {
          anexo.status = "error";
        }
        renderAnexoPreviews();
      }
    });
  }

  if (btnSalvarAnexosEscritorio) {
    btnSalvarAnexosEscritorio.addEventListener("click", async () => {
      const inspecaoId = inspecaoIdAnexoEscritorioInput.value;
      const descricao = descricaoAnexoEscritorioInput.value.trim();

      if (!inspecaoId) {
        alert("ID da Inspeção não encontrado.");
        return;
      }

      const uploadedFiles = filesToUpload.filter(
        (f) => f.status === "uploaded"
      );
      if (uploadedFiles.length === 0) {
        alert("Nenhum arquivo foi carregado com sucesso para salvar.");
        return;
      }

      const payload = {
        anexos: uploadedFiles.map((f) => ({
          tempFileName: f.tempFileName,
          originalName: f.originalName,
        })),
        descricao_anexo_escritorio: descricao,
      };

      const originalButtonHtml = btnSalvarAnexosEscritorio.innerHTML;
      btnSalvarAnexosEscritorio.disabled = true;
      btnSalvarAnexosEscritorio.innerHTML = "Salvando...";

      try {
        const response = await fetch(
          `/inspecoes-subestacoes/${inspecaoId}/anexos-escritorio`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Erro ao salvar anexos." }));
          throw new Error(errorData.message || `Erro HTTP: ${response.status}`);
        }

        const result = await response.json();
        alert(result.message || "Anexos salvos com sucesso!");
        hideModal(modalAnexosEscritorioEl);
        carregarInspecoes(currentPage);
      } catch (error) {
        alert(`Falha ao salvar anexos: ${error.message}`);
      } finally {
        btnSalvarAnexosEscritorio.disabled = false;
        btnSalvarAnexosEscritorio.innerHTML = originalButtonHtml;
      }
    });
  }

  function renderAnexoPreviewsAPR() {
    if (!previewAnexosAPRDiv || !templateAnexoPreviewAPR) return;
    previewAnexosAPRDiv.innerHTML = "";
    anexosAPRTemporarios.forEach((file, index) => {
      const clone = templateAnexoPreviewAPR.content.cloneNode(true);
      const anexoItem = clone.querySelector(".anexo-preview-item");
      const imgPreview = anexoItem.querySelector(".anexo-preview-img");
      const iconDefault = anexoItem.querySelector(
        ".anexo-preview-icon-default"
      );

      anexoItem.querySelector(".anexo-name").textContent = file.name;
      anexoItem.querySelector(".anexo-size").textContent = `${(
        file.size / 1024
      ).toFixed(1)} KB`;

      if (file.type.startsWith("image/")) {
        imgPreview.src = URL.createObjectURL(file);
        imgPreview.classList.remove("visually-hidden");
        iconDefault.classList.add("visually-hidden");
      }

      anexoItem
        .querySelector(".btn-remover-anexo")
        .addEventListener("click", () => {
          anexosAPRTemporarios.splice(index, 1);
          URL.revokeObjectURL(imgPreview.src);
          renderAnexoPreviewsAPR();
        });
      previewAnexosAPRDiv.appendChild(clone);
    });
  }

  function abrirModalAnexarAPR(inspecaoId, formNum) {
    if (!modalAnexarAPREl) return;
    formAnexarAPR.reset();
    anexosAPRTemporarios = [];
    renderAnexoPreviewsAPR();
    inspecaoIdAnexoAPRInput.value = inspecaoId;
    formNumInspecaoAnexoAPRSpan.textContent = formNum;
    showModal(modalAnexarAPREl);
  }

  function abrirModalVerAPRs(formNum, anexos) {
    if (!modalVerAPRsEl) return;
    formNumInspecaoVerAPRSpan.textContent = formNum;
    listaAPRsAnexadasUl.innerHTML = "";
    if (anexos && anexos.length > 0) {
      anexos.forEach((anexo) => {
        const li = document.createElement("li");
        li.className = "apr-anexo-item";
        li.innerHTML = `
            <a href="${anexo.caminho_servidor}" target="_blank">
              <span class="material-symbols-outlined">description</span>
              ${anexo.nome_original}
            </a>
            <button class="btn-delete-apr" data-anexo-id="${anexo.id}" title="Excluir APR">
              <span class="material-symbols-outlined">delete</span>
            </button>
          `;
        li.querySelector(".btn-delete-apr").addEventListener("click", (e) => {
          const anexoId = e.currentTarget.dataset.anexoId;
          if (
            confirm(
              `Tem certeza que deseja excluir a APR "${anexo.nome_original}"?`
            )
          ) {
            handleExcluirAPR(anexoId);
          }
        });
        listaAPRsAnexadasUl.appendChild(li);
      });
    } else {
      listaAPRsAnexadasUl.innerHTML = "<li>Nenhuma APR encontrada.</li>";
    }
    showModal(modalVerAPRsEl);
  }

  async function handleExcluirAPR(anexoId) {
    try {
      await fetchData(`/inspecoes-subestacoes/anexos/${anexoId}`, {
        method: "DELETE",
      });
      alert("APR excluída com sucesso!");
      hideModal(modalVerAPRsEl);
      carregarInspecoes(currentPage);
    } catch (error) {
      alert(`Falha ao excluir APR: ${error.message}`);
    }
  }

  if (btnAdicionarAnexoAPR) {
    btnAdicionarAnexoAPR.addEventListener("click", () =>
      arquivosAnexoAPRInput.click()
    );
  }

  if (arquivosAnexoAPRInput) {
    arquivosAnexoAPRInput.addEventListener("change", (event) => {
      anexosAPRTemporarios.push(...Array.from(event.target.files));
      renderAnexoPreviewsAPR();
      event.target.value = "";
    });
  }

  if (formAnexarAPR) {
    formAnexarAPR.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inspecaoId = inspecaoIdAnexoAPRInput.value;
      if (anexosAPRTemporarios.length === 0) {
        alert("Por favor, selecione pelo menos um arquivo de APR.");
        return;
      }

      const formData = new FormData();
      anexosAPRTemporarios.forEach((file) => {
        formData.append("anexosAPR", file, file.name);
      });

      const submitButton = formAnexarAPR.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML = `Enviando...`;

      try {
        await fetchData(`/inspecoes-subestacoes/${inspecaoId}/anexar-apr`, {
          method: "POST",
          body: formData,
        });
        alert("APR(s) enviada(s) com sucesso!");
        hideModal(modalAnexarAPREl);
        carregarInspecoes(currentPage);
      } catch (error) {
        alert(`Falha ao enviar APR(s): ${error.message}`);
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = `<span class="material-symbols-outlined">upload_file</span> Enviar APR(s)`;
      }
    });
  }

  if (formFiltrosInspecoes) {
    formFiltrosInspecoes.addEventListener("submit", (event) => {
      event.preventDefault();
      carregarInspecoes(1);
    });
  }

  if (btnLimparFiltrosInspecoes) {
    btnLimparFiltrosInspecoes.addEventListener("click", () => {
      if (formFiltrosInspecoes) formFiltrosInspecoes.reset();
      carregarInspecoes(1);
    });
  }

  function init() {
    popularFiltroSubestacoes();
    popularFiltroResponsaveis();
    carregarInspecoes(1);
  }

  init();
});
