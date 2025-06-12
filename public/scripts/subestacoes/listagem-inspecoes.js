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

  const modalDetalhesInspecao = document.getElementById(
    "modalDetalhesInspecao"
  );
  const modalDetalhesInspecaoTitulo = document.getElementById(
    "modalDetalhesInspecaoTitulo"
  );
  const corpoModalDetalhesInspecao = document.getElementById(
    "corpoModalDetalhesInspecao"
  );
  const btnFecharModalDetalhes = document.getElementById(
    "btnFecharModalDetalhes"
  );

  const modalAnexosEscritorio = document.getElementById(
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

  const imageLightbox = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const closeLightboxBtn = document.getElementById("closeLightboxBtn");

  const modalConfirmacaoGeral = document.getElementById(
    "modalConfirmacaoGeral"
  );
  const modalConfirmacaoGeralTitulo = document.getElementById(
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
  const closeModalConfirmacaoGeralButtons =
    modalConfirmacaoGeral.querySelectorAll(".close-modal");

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

  function mostrarModal(modalElement) {
    if (modalElement) modalElement.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function ocultarModal(modalElement) {
    if (modalElement) modalElement.classList.add("hidden");
    document.body.style.overflow = "";
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
      '<tr><td colspan="6" style="text-align:center;">Carregando inspeções...</td></tr>';
    nenhumaInspecaoMsg.classList.add("hidden");

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
        '<tr><td colspan="6" style="text-align:center; color:red;">Erro ao carregar inspeções.</td></tr>';
    }
  }

  function popularTabelaInspecoes(inspecoes) {
    if (!corpoTabelaInspecoes || !nenhumaInspecaoMsg) return;
    corpoTabelaInspecoes.innerHTML = "";
    if (!inspecoes || inspecoes.length === 0) {
      nenhumaInspecaoMsg.classList.remove("hidden");
      return;
    }
    nenhumaInspecaoMsg.classList.add("hidden");

    inspecoes.forEach((insp) => {
      const tr = document.createElement("tr");
      const dataAvaliacaoFormatada = formatarDataSimples(insp.data_avaliacao);

      const statusInsp = insp.status_inspecao?.toUpperCase();
      const podeConcluir =
        statusInsp === "EM_ANDAMENTO" || statusInsp === "PENDENTE_REVISAO";
      const podeRecuperar =
        statusInsp === "CONCLUIDA" || statusInsp === "CANCELADA";
      const podeExcluir = true;

      let btnConcluirHtml = `<button class="btn btn-icon" title="Inspeção não pode ser concluída neste status" disabled><span class="material-icons-outlined">check_circle_outline</span></button>`;
      if (podeConcluir) {
        btnConcluirHtml = `<button class="btn btn-icon btn-success btn-concluir-inspecao" data-id="${
          insp.id
        }" data-form-num="${
          insp.formulario_inspecao_num || insp.id
        }" title="Concluir Inspeção"><span class="material-icons-outlined">check_circle</span></button>`;
      }

      let btnRecoveryHtml = `<button class="btn btn-icon" title="Inspeção não pode ser reaberta neste status" disabled><span class="material-icons-outlined">history_toggle_off</span></button>`;
      if (podeRecuperar) {
        btnRecoveryHtml = `<button class="btn btn-icon btn-warning btn-recovery-inspecao" data-id="${
          insp.id
        }" data-form-num="${
          insp.formulario_inspecao_num || insp.id
        }" title="Reabrir Inspeção"><span class="material-icons-outlined">history</span></button>`;
      }

      let btnExcluirHtml = `<button class="btn btn-icon btn-danger btn-excluir-inspecao" data-id="${
        insp.id
      }" data-form-num="${
        insp.formulario_inspecao_num || insp.id
      }" title="Excluir Inspeção"><span class="material-icons-outlined">delete_forever</span></button>`;
      if (!podeExcluir) {
        // Lógica futura se houver restrição
        btnExcluirHtml = `<button class="btn btn-icon" title="Inspeção não pode ser excluída" disabled><span class="material-icons-outlined">delete_sweep</span></button>`;
      }

      tr.innerHTML = `
        <td class="text-center-column">${
          insp.formulario_inspecao_num || insp.id
        }</td>
        <td>${insp.subestacao_sigla}</td>
        <td class="text-center-column">${dataAvaliacaoFormatada}</td>
        <td>${insp.responsavel_nome}</td>
        <td class="text-center-column"><span class="status-badge status-${(
          insp.status_inspecao || "desconhecido"
        )
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/-/g, "_")}">${(
        insp.status_inspecao || "DESCONHECIDO"
      ).replace("_", " ")}</span></td>
        <td class="actions-column">
            <button class="btn btn-icon icon-info btn-ver-detalhes-inspecao" data-id="${
              insp.id
            }" title="Ver Detalhes da Inspeção">
                <span class="material-icons-outlined">plagiarism</span>
            </button>
             <button class="btn btn-icon icon-primary btn-anexar-escritorio" data-id="${
               insp.id
             }" title="Anexar Documentos de Escritório">
                <span class="material-icons-outlined">attach_file</span>
            </button>
            ${btnConcluirHtml}
            ${btnRecoveryHtml}
            ${btnExcluirHtml}
        </td>`;

      tr.querySelector(".btn-ver-detalhes-inspecao").addEventListener(
        "click",
        () => abrirModalDetalhesInspecao(insp.id)
      );
      tr.querySelector(".btn-anexar-escritorio").addEventListener("click", () =>
        abrirModalAnexosEscritorio(insp.id)
      );

      if (podeConcluir) {
        const btn = tr.querySelector(".btn-concluir-inspecao");
        if (btn)
          btn.addEventListener("click", (e) =>
            abrirModalConfirmacao(
              "concluir",
              e.currentTarget.dataset.id,
              `Concluir Inspeção #${e.currentTarget.dataset.formNum}`,
              "check_circle",
              "success"
            )
          );
      }
      if (podeRecuperar) {
        const btn = tr.querySelector(".btn-recovery-inspecao");
        if (btn)
          btn.addEventListener("click", (e) =>
            abrirModalConfirmacao(
              "reabrir",
              e.currentTarget.dataset.id,
              `Reabrir Inspeção #${e.currentTarget.dataset.formNum}`,
              "history",
              "warning"
            )
          );
      }
      if (podeExcluir) {
        const btn = tr.querySelector(".btn-excluir-inspecao");
        if (btn)
          btn.addEventListener("click", (e) =>
            abrirModalConfirmacao(
              "excluir",
              e.currentTarget.dataset.id,
              `Excluir Inspeção #${e.currentTarget.dataset.formNum}`,
              "delete_forever",
              "danger"
            )
          );
      }
      corpoTabelaInspecoes.appendChild(tr);
    });
  }

  function abrirModalConfirmacao(tipoAcao, id, mensagem, icone, classeBtn) {
    idParaAcao = id;
    if (modalConfirmacaoGeralTitulo)
      modalConfirmacaoGeralTitulo.textContent = `${
        tipoAcao.charAt(0).toUpperCase() + tipoAcao.slice(1)
      } Inspeção`;
    if (modalConfirmacaoGeralIcone)
      modalConfirmacaoGeralIcone.textContent = icone;
    if (mensagemConfirmacaoGeral)
      mensagemConfirmacaoGeral.textContent = `Tem certeza que deseja ${mensagem.toLowerCase()}? Esta ação pode não ser reversível.`;
    if (btnConfirmarAcaoGeral) {
      btnConfirmarAcaoGeral.className = `btn btn-${classeBtn}`;
      btnConfirmarAcaoGeral.innerHTML = `<span class="material-icons-outlined">${icone}</span> Confirmar ${
        tipoAcao.charAt(0).toUpperCase() + tipoAcao.slice(1)
      }`;
    }

    if (tipoAcao === "concluir")
      callbackAcaoConfirmada = handleConcluirInspecao;
    else if (tipoAcao === "reabrir")
      callbackAcaoConfirmada = handleReabrirInspecao;
    else if (tipoAcao === "excluir")
      callbackAcaoConfirmada = handleExcluirInspecao;
    else callbackAcaoConfirmada = null;

    if (modalConfirmacaoGeral) mostrarModal(modalConfirmacaoGeral);
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
    btnConfirmarAcaoGeral.innerHTML = `<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> ${mensagemCarregando}`;

    const style = document.createElement("style");
    style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);

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
      alert(
        result.message ||
          `Inspeção ${acao === "reabrir" ? "reaberta" : acao} com sucesso!`
      );
      ocultarModal(modalConfirmacaoGeral);
      carregarInspecoes(
        Object.fromEntries(new FormData(formFiltrosInspecoes).entries())
      );
    } catch (error) {
      alert(`Falha ao ${acao} inspeção: ${error.message}`);
    } finally {
      btnConfirmarAcaoGeral.disabled = false;
      btnConfirmarAcaoGeral.innerHTML = originalButtonHtml;
      if (style && style.parentNode) document.head.removeChild(style);
      idParaAcao = null;
      callbackAcaoConfirmada = null;
    }
  }

  if (btnConfirmarAcaoGeral && modalConfirmacaoGeral) {
    btnConfirmarAcaoGeral.addEventListener("click", () => {
      if (typeof callbackAcaoConfirmada === "function") {
        callbackAcaoConfirmada();
      }
    });
    closeModalConfirmacaoGeralButtons.forEach((button) => {
      button.addEventListener("click", () =>
        ocultarModal(modalConfirmacaoGeral)
      );
    });
  }

  function openImageLightbox(imageUrl) {
    if (lightboxImage && imageLightbox) {
      lightboxImage.src = imageUrl;
      imageLightbox.classList.add("visible");
    }
  }

  function closeImageLightbox() {
    if (imageLightbox) {
      imageLightbox.classList.remove("visible");
      if (lightboxImage) lightboxImage.src = "";
    }
  }

  if (closeLightboxBtn) {
    closeLightboxBtn.addEventListener("click", closeImageLightbox);
  }
  if (imageLightbox) {
    imageLightbox.addEventListener("click", (event) => {
      if (event.target === imageLightbox) {
        closeImageLightbox();
      }
    });
  }

  async function abrirModalDetalhesInspecao(inspecaoId) {
    if (
      !corpoModalDetalhesInspecao ||
      !modalDetalhesInspecao ||
      !modalDetalhesInspecaoTitulo
    )
      return;
    corpoModalDetalhesInspecao.innerHTML =
      '<p style="text-align:center;">Carregando detalhes...</p>';
    mostrarModal(modalDetalhesInspecao);
    try {
      const inspecao = await fetchData(`/inspecoes-subestacoes/${inspecaoId}`);
      modalDetalhesInspecaoTitulo.innerHTML = `<span class="material-icons-outlined">plagiarism</span> Detalhes Inspeção #${
        insp.formulario_inspecao_num || insp.id
      } (${inspecao.subestacao_sigla})`;

      let htmlDetalhes = `
                <div class="detalhes-cabecalho">
                    <p><strong>Nº Formulário:</strong> ${
                      inspecao.formulario_inspecao_num || inspecao.id
                    }</p>
                    <p><strong>Subestação:</strong> ${
                      inspecao.subestacao_sigla
                    } - ${inspecao.subestacao_nome}</p>
                    <p><strong>Responsável:</strong> ${
                      inspecao.responsavel_nome
                    }</p>
                    <p><strong>Data Avaliação:</strong> ${formatarDataSimples(
                      inspecao.data_avaliacao
                    )}</p>
                    <p><strong>Horário:</strong> ${inspecao.hora_inicial.substring(
                      0,
                      5
                    )} ${
        inspecao.hora_final ? "às " + inspecao.hora_final.substring(0, 5) : ""
      }</p>
                    <p><strong>Status:</strong> <span class="status-badge status-${(
                      inspecao.status_inspecao || "n/a"
                    )
                      .toLowerCase()
                      .replace(/_/g, "-")}">${(
        inspecao.status_inspecao || "N/A"
      ).replace("_", " ")}</span></p>
                </div> <hr> `;

      if (
        inspecao.gruposDeItens &&
        Object.keys(inspecao.gruposDeItens).length > 0
      ) {
        htmlDetalhes += "<h4>Itens do Checklist:</h4>";
        for (const grupoNome in inspecao.gruposDeItens) {
          htmlDetalhes += `<div class="checklist-grupo-detalhes"><h5>${grupoNome}</h5><ul>`;
          inspecao.gruposDeItens[grupoNome].forEach((item) => {
            htmlDetalhes += `<li><strong>${item.num}. ${
              item.desc
            }</strong><br> Avaliação: <span class="avaliacao-${item.avaliacao.toLowerCase()}">${
              item.avaliacao
            }</span> ${item.obs ? `<br><em>Obs: ${item.obs}</em>` : ""}`;
            if (item.anexos && item.anexos.length > 0) {
              item.anexos.forEach((anexo) => {
                htmlDetalhes += `<div class="anexo-item-detalhes"> <img src="${anexo.caminho}" alt="Evidência item ${item.num}" class="anexo-foto-item" data-src="${anexo.caminho}"> <div class="anexo-info"> <a href="${anexo.caminho}" target="_blank">${anexo.nome}</a> </div> </div>`;
              });
            }
            htmlDetalhes += `</li>`;
          });
          htmlDetalhes += "</ul></div>";
        }
      } else {
        htmlDetalhes +=
          "<p>Nenhum item de checklist registrado para esta inspeção.</p>";
      }

      if (inspecao.observacoes_gerais) {
        htmlDetalhes += `<hr><h4>Observações Gerais:</h4><p class="obs-gerais">${inspecao.observacoes_gerais}</p>`;
      }

      if (inspecao.anexosGerais && inspecao.anexosGerais.length > 0) {
        htmlDetalhes += `<hr><h4>Anexos Gerais e de Escritório:</h4><div class="anexos-detalhes-container">`;
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
          htmlDetalhes += `<div class="anexo-item-detalhes"> <span class="material-icons-outlined">${icon}</span> <div class="anexo-info"> <a href="${
            anexo.caminho
          }" target="_blank">${
            anexo.nome
          }</a> <span class="anexo-categoria" title="${
            anexo.descricao || ""
          }">${anexo.categoria.replace(/_/g, " ")}</span> ${
            anexo.descricao
              ? `<span class="anexo-descricao">${anexo.descricao}</span>`
              : ""
          } </div> </div>`;
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
        '<p style="text-align:center; color:red;">Erro ao carregar detalhes da inspeção.</p>';
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
      !modalAnexosEscritorio
    )
      return;
    formAnexosEscritorio.reset();
    inspecaoIdAnexoEscritorioInput.value = inspecaoId;
    displayInspecaoIdAnexoEscritorio.textContent = inspecaoId;
    modalAnexosEscritorioTitulo.innerHTML = `<span class="material-icons-outlined">upload_file</span> Anexar Documentos (Inspeção ID: ${inspecaoId})`;
    listaNomesAnexosEscritorio.innerHTML = "";
    mostrarModal(modalAnexosEscritorio);
  }

  if (arquivosAnexoEscritorioInput && listaNomesAnexosEscritorio) {
    arquivosAnexoEscritorioInput.addEventListener("change", () => {
      listaNomesAnexosEscritorio.innerHTML = "";
      if (arquivosAnexoEscritorioInput.files.length > 0) {
        for (const file of arquivosAnexoEscritorioInput.files) {
          const li = document.createElement("li");
          li.innerHTML = `<span class="material-icons-outlined">description</span> ${
            file.name
          } (${(file.size / 1024).toFixed(1)} KB)`;
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
    modalAnexosEscritorio
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
      for (let i = 0; i < files.length; i++) {
        formData.append("anexosEscritorio", files[i]);
      }
      if (descricao) {
        formData.append("descricao_anexo_escritorio", descricao);
      }

      const originalButtonHtml = btnSalvarAnexosEscritorio.innerHTML;
      btnSalvarAnexosEscritorio.disabled = true;
      btnSalvarAnexosEscritorio.innerHTML =
        '<span class="material-icons-outlined spin" style="animation: spin 1s linear infinite;">sync</span> Salvando...';
      const style = document.createElement("style");
      style.innerHTML = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);

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
        ocultarModal(modalAnexosEscritorio);
        carregarInspecoes(
          Object.fromEntries(new FormData(formFiltrosInspecoes).entries())
        );
      } catch (error) {
        alert(`Falha ao salvar anexos: ${error.message}`);
        console.error("Falha ao salvar anexos de escritório:", error);
      } finally {
        btnSalvarAnexosEscritorio.disabled = false;
        btnSalvarAnexosEscritorio.innerHTML = originalButtonHtml;
        if (style && style.parentNode) document.head.removeChild(style);
      }
    });
  }

  if (formFiltrosInspecoes) {
    formFiltrosInspecoes.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(formFiltrosInspecoes);
      const params = {};
      for (let [key, value] of formData.entries()) {
        if (value) params[key] = value;
      }
      carregarInspecoes(params);
    });
  }

  if (btnLimparFiltrosInspecoes) {
    btnLimparFiltrosInspecoes.addEventListener("click", () => {
      if (formFiltrosInspecoes) formFiltrosInspecoes.reset();
      carregarInspecoes();
    });
  }

  if (modalDetalhesInspecao) {
    const allCloseButtons =
      modalDetalhesInspecao.querySelectorAll(".close-modal");
    allCloseButtons.forEach((button) => {
      button.addEventListener("click", () =>
        ocultarModal(modalDetalhesInspecao)
      );
    });
    if (btnFecharModalDetalhes) {
      // Specific button in footer
      btnFecharModalDetalhes.addEventListener("click", () =>
        ocultarModal(modalDetalhesInspecao)
      );
    }
  }
  if (modalAnexosEscritorio) {
    const allCloseButtons =
      modalAnexosEscritorio.querySelectorAll(".close-modal");
    allCloseButtons.forEach((button) => {
      button.addEventListener("click", () =>
        ocultarModal(modalAnexosEscritorio)
      );
    });
  }

  window.addEventListener("click", (event) => {
    if (event.target === modalDetalhesInspecao) {
      ocultarModal(modalDetalhesInspecao);
    }
    if (event.target === modalAnexosEscritorio) {
      ocultarModal(modalAnexosEscritorio);
    }
    if (event.target === modalConfirmacaoGeral) {
      ocultarModal(modalConfirmacaoGeral);
    }
    if (event.target === imageLightbox) {
      closeImageLightbox();
    }
  });

  function init() {
    popularFiltroSubestacoes();
    popularFiltroResponsaveis();
    carregarInspecoes();
  }
  init();
});
