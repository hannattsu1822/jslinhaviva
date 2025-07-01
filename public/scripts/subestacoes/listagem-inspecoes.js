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
  const modalAnexosTermografiaItemEl = document.getElementById(
    "modalAnexosTermografiaItem"
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

  // Removido referências ao modal de termografia que não são mais necessárias aqui
  // ...

  let idParaAcao = null;
  let callbackAcaoConfirmada = null;
  let filesToUpload = [];
  // Removido termografiaFilesToUpload e inspecaoItensCache pois não são mais usados aqui

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

  async function carregarInspecoes(params = {}) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    corpoTabelaInspecoes.innerHTML =
      '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Carregando inspeções...</td></tr>';
    nenhumaInspecaoMsg.style.display = "none";

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
        '<tr><td colspan="7" style="text-align: center; color: red; padding: 2rem;">Erro ao carregar inspeções.</td></tr>';
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

      let btnConcluirHtml = `<button class="btn" title="Inspeção não pode ser concluída" disabled><span class="material-symbols-outlined">task_alt</span></button>`;
      if (podeConcluir) {
        btnConcluirHtml = `<button class="btn text-success btn-concluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Concluir Inspeção"><span class="material-symbols-outlined">task_alt</span></button>`;
      }

      let btnRecoveryHtml = `<button class="btn" title="Inspeção não pode ser reaberta" disabled><span class="material-symbols-outlined">history</span></button>`;
      if (podeRecuperar) {
        btnRecoveryHtml = `<button class="btn text-warning btn-recovery-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Reabrir Inspeção"><span class="material-symbols-outlined">history</span></button>`;
      }

      let btnExcluirHtml = `<button class="btn text-danger btn-excluir-inspecao" data-id="${insp.id}" data-form-num="${formNumId}" title="Excluir Inspeção"><span class="material-symbols-outlined">delete</span></button>`;

      // *** CORREÇÃO AQUI: Botão de termografia removido ***
      tr.innerHTML = `
        <td class="text-center">${formNumId}</td>
        <td>${insp.processo || "-"}</td>
        <td>${insp.subestacao_sigla}</td>
        <td class="text-center">${dataAvaliacaoFormatada}</td>
        <td>${insp.responsavel_nome}</td>
        <td class="text-center"><span class="status-badge status-${statusClasseFinal}">${statusTextoDisplay}</span></td>
        <td class="actions-column">
            <button class="btn text-info btn-ver-detalhes-inspecao" data-id="${
              insp.id
            }" title="Ver Detalhes"><span class="material-symbols-outlined">visibility</span></button>
            <button class="btn text-primary btn-anexar-escritorio" data-id="${
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
      tr.querySelector(".btn-anexar-escritorio")?.addEventListener(
        "click",
        () => abrirModalAnexosEscritorio(insp.id)
      );
      // Removido o event listener do botão de termografia
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
    renderAnexoPreviews(filesToUpload, previewAnexosEscritorio);
    inspecaoIdAnexoEscritorioInput.value = inspecaoId;
    displayInspecaoIdAnexoEscritorio.textContent = inspecaoId;
    showModal(modalAnexosEscritorioEl);
  }

  function renderAnexoPreviews(fileList, container) {
    if (!container || !templateAnexoPreview) return;
    container.innerHTML = "";
    fileList.forEach((file, index) => {
      const previewClone = templateAnexoPreview.content.cloneNode(true);
      const previewItem = previewClone.querySelector(".anexo-preview-item");
      const imgPreview = previewClone.querySelector(".anexo-preview-img");
      const iconDefault = previewClone.querySelector(
        ".anexo-preview-icon-default"
      );
      const previewName = previewClone.querySelector(".anexo-name");
      const previewSize = previewClone.querySelector(".anexo-size");
      const removeBtn = previewClone.querySelector(".btn-remover-anexo");

      previewName.textContent = file.name;
      previewSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imgPreview.src = e.target.result;
          imgPreview.classList.remove("visually-hidden");
          iconDefault.classList.add("visually-hidden");
        };
        reader.readAsDataURL(file);
      } else {
        imgPreview.classList.add("visually-hidden");
        iconDefault.classList.remove("visually-hidden");
      }

      removeBtn.addEventListener("click", () => {
        fileList.splice(index, 1);
        renderAnexoPreviews(fileList, container);
      });

      container.appendChild(previewItem);
    });
  }

  if (btnAdicionarAnexoEscritorio) {
    btnAdicionarAnexoEscritorio.addEventListener("click", () => {
      arquivosAnexoEscritorioInput.click();
    });
  }

  if (arquivosAnexoEscritorioInput) {
    arquivosAnexoEscritorioInput.addEventListener("change", (event) => {
      const newFiles = Array.from(event.target.files);
      if (filesToUpload.length + newFiles.length > 5) {
        alert("Você pode anexar no máximo 5 arquivos por vez.");
        event.target.value = null;
        return;
      }
      filesToUpload.push(...newFiles);
      renderAnexoPreviews(filesToUpload, previewAnexosEscritorio);
      event.target.value = null;
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
      if (filesToUpload.length === 0) {
        alert("Selecione pelo menos um arquivo para anexar.");
        return;
      }

      const formData = new FormData();
      filesToUpload.forEach((file) => {
        formData.append("anexosEscritorio", file);
      });
      if (descricao) {
        formData.append("descricao_anexo_escritorio", descricao);
      }

      const originalButtonHtml = btnSalvarAnexosEscritorio.innerHTML;
      btnSalvarAnexosEscritorio.disabled = true;
      btnSalvarAnexosEscritorio.innerHTML = "Salvando...";

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
        hideModal(modalAnexosEscritorioEl);
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

  // Removida toda a lógica do modal de termografia que estava aqui

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
