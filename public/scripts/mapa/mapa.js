import {
  showLoading,
  hideLoading,
  showError,
  showMessage,
  parseHTMLDescription,
} from "./mapa-ui.js";

class MapaDinamico {
  constructor() {
    this.mapa = null;
    this.camadas = {};
    this.arquivosCarregados = [];
    this.tiposDisponiveis = new Set();
    this.markerClusters = {};

    // Configuração simplificada para 3 tipos de ícones
    this.legendaCores = {
      poste: { cor: "#000000", forma: "circle" }, // Preto - Círculo
      seccionadora: { cor: "#ff0000", forma: "square" }, // Vermelho - Quadrado
      trafo: { cor: "#3388ff", forma: "triangle" }, // Azul - Triângulo
      ponto_coletado: { cor: "#FF5722", forma: "star" }, // Laranja - Estrela (para pontos coletados)
    };

    // Mapeamento de tipos genéricos
    this.mapeamentoTipos = {
      // Postes
      poste: "poste",
      po: "poste",

      // Seccionadoras
      seccionadora: "seccionadora",
      chave: "seccionadora",
      se: "seccionadora",
      cf: "seccionadora",
      fr: "seccionadora",

      // Transformadores
      trafo: "trafo",
      transformador: "trafo",
      tr: "trafo",

      // Pontos coletados
      ponto_coletado: "ponto_coletado",
    };

    // Variáveis para coleta de GPS
    this.marcadorUsuario = null;
    this.coordenadasColetadas = [];
    this.ultimaCoordenada = null;
    this.watchId = null;
    this.controleColeta = null;
  }

  async carregarArquivo(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao carregar arquivo: ${url}`);
    }
    return await response.json();
  }

  criarIconePersonalizado(cor, forma) {
    const size = 8; // Reduzido de 12 para 8
    const anchor = size * 1.5;

    return L.divIcon({
      html: `<div style="
                width: ${size}px;
                height: ${size}px;
                background: ${cor};
                border-radius: ${forma === "circle" ? "50%" : "0"};
                clip-path: ${this.getClipPath(forma)};
                position: relative;
            "></div>`,
      className: "custom-marker",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  getClipPath(forma) {
    switch (forma) {
      case "triangle":
        return "polygon(50% 0%, 0% 100%, 100% 100%)";
      case "square":
        return "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)";
      case "star":
        return "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
      default:
        return "circle(50% at 50% 50%)";
    }
  }

  async init() {
    await this.carregarPlugins();
    this.inicializarMapa();
    await this.carregarArquivosData();
    this.criarInterfaceFiltros();
    this.criarLegenda();
    this.adicionarControles();
    this.configurarEventosGPS();
  }

  configurarEventosGPS() {
    document.getElementById("btn-ativar-gps").addEventListener("click", () => {
      if (this.watchId) {
        this.pararColetaGPS();
      } else {
        this.ativarColetaGPS();
      }
    });
  }

  ativarColetaGPS() {
    if (navigator.geolocation) {
      showMessage(
        "Coleta de GPS ativada. Movimente-se para coletar pontos.",
        "info"
      );

      // Monitora posição continuamente
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.atualizarPosicaoUsuario(position),
        (error) => this.tratarErroGPS(error),
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );

      // Adiciona botão para salvar pontos
      this.adicionarControleColeta();
    } else {
      showError("Geolocalização não suportada pelo navegador");
    }
  }

  atualizarPosicaoUsuario(position) {
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: new Date(position.timestamp),
    };

    // Atualiza ou cria marcador do usuário
    if (!this.marcadorUsuario) {
      const iconeUsuario = L.divIcon({
        html: '<div style="background: #4CAF50; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white;"></div>',
        className: "marcador-usuario",
        iconSize: [20, 20],
      });

      this.marcadorUsuario = L.marker([coords.lat, coords.lng], {
        icon: iconeUsuario,
        zIndexOffset: 1000,
      }).addTo(this.mapa);

      this.marcadorUsuario.bindPopup("Sua posição atual").openPopup();
    } else {
      this.marcadorUsuario.setLatLng([coords.lat, coords.lng]);
    }

    // Centraliza mapa na posição do usuário
    this.mapa.setView([coords.lat, coords.lng], 17);

    // Armazena coordenada para possível salvamento
    this.ultimaCoordenada = coords;
  }

  tratarErroGPS(error) {
    let mensagem;
    switch (error.code) {
      case error.PERMISSION_DENIED:
        mensagem = "Permissão de localização negada. Ative no navegador.";
        break;
      case error.POSITION_UNAVAILABLE:
        mensagem = "Informação de localização indisponível.";
        break;
      case error.TIMEOUT:
        mensagem = "Tempo de espera para obter localização expirado.";
        break;
      default:
        mensagem = "Erro desconhecido ao obter localização.";
    }
    showError(mensagem);
  }

  adicionarControleColeta() {
    // Remove controles existentes se houver
    if (this.controleColeta) {
      this.mapa.removeControl(this.controleColeta);
    }

    // Cria novo controle
    this.controleColeta = L.control({ position: "bottomright" });

    this.controleColeta.onAdd = () => {
      const div = L.DomUtil.create("div", "controle-coleta");
      div.innerHTML = `
                <button id="btn-coletar-ponto" class="btn btn-primary btn-sm">
                    <i class="bi bi-geo-alt"></i> Coletar Ponto
                </button>
                <button id="btn-parar-coleta" class="btn btn-danger btn-sm mt-1">
                    <i class="bi bi-stop-fill"></i> Parar
                </button>
                <button id="btn-salvar-coleta" class="btn btn-success btn-sm mt-1">
                    <i class="bi bi-save"></i> Salvar
                </button>
            `;
      return div;
    };

    this.controleColeta.addTo(this.mapa);

    // Adiciona eventos
    document
      .getElementById("btn-coletar-ponto")
      .addEventListener("click", () => {
        if (this.ultimaCoordenada) {
          this.coletarPontoAtual();
        }
      });

    document
      .getElementById("btn-parar-coleta")
      .addEventListener("click", () => {
        this.pararColetaGPS();
      });

    document
      .getElementById("btn-salvar-coleta")
      .addEventListener("click", () => {
        this.salvarPontosColetados();
      });
  }

  coletarPontoAtual() {
    if (!this.ultimaCoordenada) return;

    const ponto = {
      type: "Feature",
      properties: {
        tipo: "ponto_coletado",
        accuracy: this.ultimaCoordenada.accuracy,
        timestamp: this.ultimaCoordenada.timestamp.toISOString(),
        coletado_por: "usuario_movel",
      },
      geometry: {
        type: "Point",
        coordinates: [this.ultimaCoordenada.lng, this.ultimaCoordenada.lat],
      },
    };

    // Adiciona ao array de pontos coletados
    this.coordenadasColetadas.push(ponto);

    // Cria marcador no mapa
    const iconeColetado = this.criarIconePersonalizado(
      this.legendaCores.ponto_coletado.cor,
      this.legendaCores.ponto_coletado.forma
    );

    const marker = L.marker(
      [this.ultimaCoordenada.lat, this.ultimaCoordenada.lng],
      {
        icon: iconeColetado,
      }
    ).addTo(this.mapa);

    marker.bindPopup(`Ponto coletado (${this.coordenadasColetadas.length})`);

    showMessage(
      `Ponto coletado! Total: ${this.coordenadasColetadas.length}`,
      "success"
    );
  }

  pararColetaGPS() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.marcadorUsuario) {
      this.mapa.removeLayer(this.marcadorUsuario);
      this.marcadorUsuario = null;
    }

    if (this.controleColeta) {
      this.mapa.removeControl(this.controleColeta);
      this.controleColeta = null;
    }

    document.getElementById("btn-ativar-gps").classList.remove("active");
    showMessage("Coleta de GPS desativada", "info");
  }

  async salvarPontosColetados() {
    if (this.coordenadasColetadas.length === 0) {
      showError("Nenhum ponto coletado para salvar");
      return;
    }

    try {
      showLoading("Salvando pontos coletados...");

      const response = await fetch("/api/salvar-pontos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          features: this.coordenadasColetadas,
          arquivo_destino: "pontos_coletados.geojson",
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar pontos");
      }

      const result = await response.json();
      showMessage(
        `${result.pontos_salvos} pontos salvos com sucesso!`,
        "success"
      );

      // Limpa pontos coletados após salvar
      this.coordenadasColetadas = [];

      // Recarrega os dados do mapa para mostrar os novos pontos
      await this.carregarArquivosData();
    } catch (error) {
      showError(`Erro ao salvar pontos: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  async carregarPlugins() {
    const plugins = [
      "https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js",
      "https://unpkg.com/leaflet.featuregroup.subgroup@1.0.2/dist/leaflet.featuregroup.subgroup.js",
      "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js",
    ];

    await Promise.all(
      plugins.map((url) => {
        return new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = url;
          script.onload = resolve;
          document.head.appendChild(script);
        });
      })
    );
  }

  inicializarMapa() {
    this.mapa = L.map("mapa", {
      zoomControl: false,
      preferCanvas: true,
      fadeAnimation: false,
      markerZoomAnimation: false,
      maxZoom: 19,
      minZoom: 3,
    }).setView([-15.7889, -47.8792], 13);

    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        detectRetina: true,
      }
    ).addTo(this.mapa);

    const sateliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
        detectRetina: true,
      }
    );

    const topoLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution:
          'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a>',
        maxZoom: 17,
      }
    );

    const baseLayers = {
      OpenStreetMap: osmLayer,
      Satélite: sateliteLayer,
      Topográfico: topoLayer,
    };

    L.control
      .layers(baseLayers, null, {
        position: "topright",
        collapsed: false,
      })
      .addTo(this.mapa);

    L.control
      .zoom({
        position: "topright",
      })
      .addTo(this.mapa);
  }

  async carregarArquivosData() {
    try {
      showLoading("Carregando arquivos de dados...");

      const response = await fetch("/api/arquivos-data");
      if (!response.ok) throw new Error("Falha ao carregar lista de arquivos");

      const arquivos = await response.json();
      if (!arquivos.length)
        throw new Error("Nenhum arquivo encontrado na pasta data");

      showMessage(
        `Encontrados ${arquivos.length} arquivos na pasta data`,
        "info"
      );

      for (const arquivo of arquivos) {
        try {
          const data = await this.carregarArquivo(`/data/${arquivo}`);
          this.processarDadosArquivo(data, arquivo);
        } catch (error) {
          console.error(`Erro ao processar ${arquivo}:`, error);
          showMessage(
            `Erro ao processar ${arquivo}: ${error.message}`,
            "danger"
          );
        }
      }

      if (this.arquivosCarregados.length === 0) {
        throw new Error("Nenhum arquivo válido foi carregado");
      }
    } catch (error) {
      showError(error.message);
      console.error("Erro no carregamento:", error);
    } finally {
      hideLoading();
    }
  }

  processarDadosArquivo(data, nomeArquivo) {
    if (!data.features || !Array.isArray(data.features)) {
      throw new Error("Formato GeoJSON inválido");
    }

    const tipoBase = nomeArquivo.split(".")[0].toLowerCase();
    let contador = 0;

    if (!this.markerClusters[tipoBase]) {
      this.markerClusters[tipoBase] = L.markerClusterGroup({
        chunkedLoading: true,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 16,
        maxClusterRadius: function (zoom) {
          return zoom === 3
            ? 120
            : zoom < 8
            ? 80
            : zoom < 12
            ? 60
            : zoom < 16
            ? 40
            : 20;
        },
        iconCreateFunction: function (cluster) {
          const childCount = cluster.getChildCount();
          const zoom = this._map.getZoom();

          if (zoom < 8) {
            return L.divIcon({
              html: `<div style="
                                background: rgba(59, 130, 246, 0.8);
                                color: white;
                                border-radius: 50%;
                                width: 40px;
                                height: 40px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                font-size: 14px;
                            ">${childCount}</div>`,
              className: "cluster-marker",
              iconSize: L.point(40, 40),
            });
          }

          return L.divIcon({
            html: `<div style="
                            background: rgba(59, 130, 246, 0.6);
                            color: white;
                            border-radius: 50%;
                            width: 30px;
                            height: 30px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-weight: bold;
                            font-size: 12px;
                        ">${childCount}</div>`,
            className: "cluster-marker",
            iconSize: L.point(30, 30),
          });
        },
      });
    }

    data.features.forEach((feature) => {
      if (feature.geometry?.type === "Point") {
        const tipo = feature.properties?.tipo || tipoBase;
        const tipoNormalizado =
          this.mapeamentoTipos[tipo.toLowerCase()] || "poste";
        this.tiposDisponiveis.add(tipoNormalizado);

        if (!this.camadas[tipoNormalizado]) {
          this.camadas[tipoNormalizado] = L.layerGroup();
        }

        const marker = this.criarMarcador(
          feature,
          tipoNormalizado,
          nomeArquivo
        );
        this.camadas[tipoNormalizado].addLayer(marker);
        this.markerClusters[tipoBase].addLayer(marker);
        contador++;
      }
    });

    this.arquivosCarregados.push({
      nome: nomeArquivo,
      tipo: tipoBase,
      quantidade: contador,
      visivel: true,
    });
  }

  criarMarcador(feature, tipo, nomeArquivo) {
    const tipoNormalizado = this.mapeamentoTipos[tipo.toLowerCase()] || "poste";

    const ativo = {
      ...feature.properties,
      tipo: tipoNormalizado,
      geometry: feature.geometry,
      arquivoOrigem: nomeArquivo,
    };

    const configIcone = this.legendaCores[tipoNormalizado];
    const iconePersonalizado = this.criarIconePersonalizado(
      configIcone.cor,
      configIcone.forma
    );

    const marker = L.marker(
      [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
      {
        icon: iconePersonalizado,
        className: `marker-${tipoNormalizado}`,
        riseOnHover: true,
      }
    );

    return this.configurarMarcador(marker, ativo, tipoNormalizado, nomeArquivo);
  }

  configurarMarcador(marker, ativo, tipo, nomeArquivo) {
    const detalhes = parseHTMLDescription(ativo.description) || {};

    const tipoFormatado =
      {
        poste: "Poste",
        seccionadora: "Seccionadora",
        trafo: "Transformador",
        ponto_coletado: "Ponto Coletado",
      }[tipo] || tipo.toUpperCase();

    const popupContent = `
            <div class="mapa-popup">
                <h6>${ativo.codigo || ativo.Name || "Sem código"}</h6>
                <div class="info-item">
                    <span class="info-label">TIPO:</span>
                    <span class="info-value">${tipoFormatado}</span>
                </div>
                ${
                  detalhes.id
                    ? `<div class="info-item">
                    <span class="info-label">ID:</span>
                    <span class="info-value">${detalhes.id}</span>
                </div>`
                    : ""
                }
                ${
                  detalhes.idsubestac
                    ? `<div class="info-item">
                    <span class="info-label">SUBESTAÇÃO:</span>
                    <span class="info-value">${detalhes.idsubestac}</span>
                </div>`
                    : ""
                }
                ${
                  detalhes.nome_alime
                    ? `<div class="info-item">
                    <span class="info-label">ALIMENTADOR:</span>
                    <span class="info-value">${detalhes.nome_alime}</span>
                </div>`
                    : ""
                }
                <div class="d-flex gap-2 mt-2">
                    <button class="btn btn-sm btn-primary flex-grow-1 btn-detalhes" 
                            data-id="${ativo.id}" 
                            data-bs-toggle="modal" 
                            data-bs-target="#detalhesModal">
                        <i class="bi bi-info-circle"></i> Detalhes
                    </button>
                    <button class="btn btn-sm btn-outline-secondary btn-zoom" 
                            data-lat="${ativo.geometry.coordinates[1]}" 
                            data-lng="${ativo.geometry.coordinates[0]}">
                        <i class="bi bi-zoom-in"></i>
                    </button>
                </div>
            </div>
        `;

    const popup = L.popup({
      maxWidth: 300,
      className: "custom-popup",
      autoClose: false,
      closeOnClick: false,
    }).setContent(popupContent);

    marker.bindPopup(popup);

    marker.on("click", (e) => {
      this.mostrarDetalhesAtivo(ativo);
      if (!this.mapa.getBounds().contains(e.latlng)) {
        this.mapa.flyTo(e.latlng, this.mapa.getZoom());
      }
    });

    return marker;
  }

  criarInterfaceFiltros() {
    // Atualiza contadores
    document.getElementById("contador-arquivos").textContent =
      this.arquivosCarregados.length;
    document.getElementById("contador-tipos").textContent =
      this.tiposDisponiveis.size;
    document.getElementById("contador-ativos").textContent =
      this.arquivosCarregados.reduce(
        (acc, arquivo) => acc + arquivo.quantidade,
        0
      );

    // Preenche lista de arquivos
    const listaArquivos = document.getElementById("lista-arquivos");
    this.arquivosCarregados.forEach((arquivo) => {
      const item = document.createElement("div");
      item.className = "form-check";
      item.innerHTML = `
                <input class="form-check-input" type="checkbox" id="arquivo-${arquivo.nome}" checked>
                <label class="form-check-label" for="arquivo-${arquivo.nome}">
                    ${arquivo.nome} <small class="text-muted">(${arquivo.quantidade})</small>
                </label>
            `;
      listaArquivos.appendChild(item);
    });

    // Preenche lista de tipos
    const listaTipos = document.getElementById("lista-tipos");
    Array.from(this.tiposDisponiveis).forEach((tipo) => {
      const item = document.createElement("div");
      item.className = "form-check";
      item.innerHTML = `
                <input class="form-check-input" type="checkbox" id="tipo-${tipo}" checked>
                <label class="form-check-label" for="tipo-${tipo}">
                    ${this.formatarTipoLegenda(tipo)}
                </label>
            `;
      listaTipos.appendChild(item);
    });

    // Evento para aplicar filtros
    document
      .getElementById("btn-aplicar-filtros")
      .addEventListener("click", () => this.aplicarFiltros());
    document
      .getElementById("btn-resetar-filtros")
      .addEventListener("click", () => this.resetarFiltros());
  }

  aplicarFiltros() {
    // Lógica para aplicar filtros selecionados
    const arquivosAtivos = Array.from(
      document.querySelectorAll("#lista-arquivos .form-check-input:checked")
    ).map((el) => el.id.replace("arquivo-", ""));
    const tiposAtivos = Array.from(
      document.querySelectorAll("#lista-tipos .form-check-input:checked")
    ).map((el) => el.id.replace("tipo-", ""));

    // Oculta/Exibe camadas conforme filtros
    Object.entries(this.camadas).forEach(([tipo, camada]) => {
      if (tiposAtivos.includes(tipo)) {
        this.mapa.addLayer(camada);
      } else {
        this.mapa.removeLayer(camada);
      }
    });

    showMessage(
      `Filtros aplicados: ${arquivosAtivos.length} arquivos e ${tiposAtivos.length} tipos visíveis`,
      "success"
    );
  }

  resetarFiltros() {
    document
      .querySelectorAll("#lista-arquivos .form-check-input")
      .forEach((el) => (el.checked = true));
    document
      .querySelectorAll("#lista-tipos .form-check-input")
      .forEach((el) => (el.checked = true));
    this.aplicarFiltros();
  }

  criarLegenda() {
    const legendaItens = document.getElementById("legenda-itens");
    legendaItens.innerHTML = "";

    const tiposLegenda = ["poste", "seccionadora", "trafo", "ponto_coletado"];

    tiposLegenda.forEach((tipo) => {
      if (!this.legendaCores[tipo]) return;

      const config = this.legendaCores[tipo];
      const itemLegenda = document.createElement("div");
      itemLegenda.className = "legenda-item";

      itemLegenda.innerHTML = `
                <div class="legenda-icone">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        ${this.getSvgShape(config.forma, config.cor)}
                    </svg>
                </div>
                <div class="legenda-texto">
                    ${this.formatarTipoLegenda(tipo)}
                </div>
            `;

      legendaItens.appendChild(itemLegenda);
    });
  }

  formatarTipoLegenda(tipo) {
    const nomes = {
      poste: "Poste",
      seccionadora: "Seccionadora",
      trafo: "Transformador",
      ponto_coletado: "Ponto Coletado",
    };
    return nomes[tipo] || tipo;
  }

  getSvgShape(forma, cor) {
    switch (forma) {
      case "circle":
        return `<circle cx="12" cy="12" r="8" fill="${cor}"/>`;
      case "square":
        return `<rect x="6" y="6" width="12" height="12" fill="${cor}"/>`;
      case "triangle":
        return `<path d="M12 4 L20 18 L4 18 Z" fill="${cor}"/>`;
      case "star":
        return `<path d="M12 2 L15 9 L22 9 L16 14 L19 21 L12 17 L5 21 L8 14 L2 9 L9 9 Z" fill="${cor}"/>`;
      default:
        return `<circle cx="12" cy="12" r="8" fill="${cor}"/>`;
    }
  }

  adicionarControles() {
    // Cria grupo de features se não existir
    if (!this.camadas.ativos) {
      this.camadas.ativos = L.featureGroup().addTo(this.mapa);
    }

    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: true,
        polyline: false,
        rectangle: true,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: this.camadas.ativos,
        edit: false,
      },
    });
    this.mapa.addControl(drawControl);

    this.mapa.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      const type = e.layerType;

      this.camadas.ativos.addLayer(layer);

      if (type === "polygon" || type === "rectangle") {
        this.filtrarAtivosDentroDePoligono(layer);
      }
    });
  }

  filtrarAtivosDentroDePoligono(polygon) {
    const bounds = polygon.getBounds();
    let ativosFiltrados = 0;

    Object.values(this.camadas).forEach((camada) => {
      camada.eachLayer((marker) => {
        if (bounds.contains(marker.getLatLng())) {
          marker.addTo(this.mapa);
          ativosFiltrados++;
        } else {
          this.mapa.removeLayer(marker);
        }
      });
    });

    showMessage(
      `Encontrados ${ativosFiltrados} ativos na área selecionada`,
      "info"
    );
  }

  mostrarDetalhesAtivo(ativo) {
    const modalTitulo = document.getElementById("detalhes-titulo");
    const modalConteudo = document.getElementById("detalhes-conteudo");

    modalTitulo.innerHTML = `<i class="bi bi-info-circle"></i> Detalhes do ${this.formatarTipoLegenda(
      ativo.tipo
    )}`;

    const detalhes = parseHTMLDescription(ativo.description) || {};
    let html = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="mb-3">Informações Básicas</h6>
                    <table class="table table-sm">
                        <tr><th>Código</th><td>${
                          ativo.codigo || "N/A"
                        }</td></tr>
                        <tr><th>Tipo</th><td>${this.formatarTipoLegenda(
                          ativo.tipo
                        )}</td></tr>
                        <tr><th>Arquivo</th><td>${ativo.arquivoOrigem}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6 class="mb-3">Localização</h6>
                    <table class="table table-sm">
                        <tr><th>Latitude</th><td>${ativo.geometry.coordinates[1].toFixed(
                          6
                        )}</td></tr>
                        <tr><th>Longitude</th><td>${ativo.geometry.coordinates[0].toFixed(
                          6
                        )}</td></tr>
                    </table>
                </div>
            </div>
        `;

    if (Object.keys(detalhes).length > 0) {
      html += `
                <div class="mt-4">
                    <h6 class="mb-3">Detalhes Técnicos</h6>
                    <table class="table table-sm">
                        ${Object.entries(detalhes)
                          .map(
                            ([key, value]) => `
                            <tr><th>${key.toUpperCase()}</th><td>${value}</td></tr>
                        `
                          )
                          .join("")}
                    </table>
                </div>
            `;
    }

    modalConteudo.innerHTML = html;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const mapaApp = new MapaDinamico();
  mapaApp.init();
});
