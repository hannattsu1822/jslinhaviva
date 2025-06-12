import {
  showLoading,
  hideLoading,
  showError,
  showMessage,
} from "../mapa/mapa-ui.js";

document.addEventListener("DOMContentLoaded", () => {
  const btnRegistrarPonto = document.getElementById("btn-registrar-ponto");
  const btnExportarInspecao = document.getElementById("btn-exportar-inspecao");
  const motivoInput = document.getElementById("motivo-ponto");
  const fotoInput = document.getElementById("foto-ponto");
  const listaPontosRegistrados = document.getElementById(
    "lista-pontos-registrados"
  );
  const gpsStatusDiv = document.getElementById("gps-status");
  const nenhumPontoRegistradoLi = document.getElementById(
    "nenhum-ponto-registrado"
  );
  const mapPreviewContainer = document.getElementById("map-preview-container");

  let db;
  let currentCoordinates = null;
  const DB_NAME = "inspecoesDB";
  const STORE_NAME = "pontosInspecao";

  let inspectionMap = null;
  let mapMarkers = {};

  function initInspectionMap() {
    if (!mapPreviewContainer) {
      console.error("Elemento do mapa não encontrado!");
      return;
    }
    const initialCoords = currentCoordinates
      ? [currentCoordinates.latitude, currentCoordinates.longitude]
      : [-15.7801, -47.9292];
    const initialZoom = currentCoordinates ? 15 : 5;

    inspectionMap = L.map(mapPreviewContainer).setView(
      initialCoords,
      initialZoom
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(inspectionMap);

    L.control.zoom({ position: "topright" }).addTo(inspectionMap);
  }

  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = (event) => {
        showError("Erro ao abrir o banco de dados local.");
        console.error("IndexedDB error:", event);
        reject("Erro DB");
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        console.log("Banco de dados local aberto com sucesso.");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
          console.log("Object store criado.");
        }
      };
    });
  }

  function getGPSLocation() {
    if (navigator.geolocation) {
      gpsStatusDiv.textContent = "Obtendo localização GPS...";
      btnRegistrarPonto.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          gpsStatusDiv.textContent = `GPS: Lat ${currentCoordinates.latitude.toFixed(
            5
          )}, Lon ${currentCoordinates.longitude.toFixed(
            5
          )} (Precisão: ${currentCoordinates.accuracy.toFixed(1)}m)`;
          btnRegistrarPonto.disabled = false;
          showMessage("Localização GPS obtida!", "success");
          if (inspectionMap && !mapMarkers[Object.keys(mapMarkers)[0]]) {
            // Center map on first GPS lock if no points yet
            inspectionMap.setView(
              [currentCoordinates.latitude, currentCoordinates.longitude],
              15
            );
          }
        },
        (error) => {
          currentCoordinates = null;
          gpsStatusDiv.textContent =
            "Não foi possível obter a localização GPS.";
          btnRegistrarPonto.disabled = false;
          showError(`Erro GPS: ${error.message}`);
          console.error("GPS Error:", error);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      currentCoordinates = null;
      gpsStatusDiv.textContent =
        "Geolocalização não é suportada por este navegador.";
      showError("Geolocalização não suportada.");
    }
  }

  function getPhotoBlob() {
    return new Promise((resolve) => {
      const file = fotoInput.files[0];
      if (file) {
        resolve(file);
      } else {
        resolve(null);
      }
    });
  }

  async function registrarPonto() {
    if (!currentCoordinates) {
      showError(
        "Localização GPS não disponível. Tente obter a localização novamente."
      );
      getGPSLocation();
      return;
    }

    const motivo = motivoInput.value.trim();
    if (!motivo) {
      showError("Por favor, insira um motivo para o ponto.");
      return;
    }

    showLoading("Registrando ponto...");
    const photoBlob = await getPhotoBlob();

    const novoPonto = {
      latitude: currentCoordinates.latitude,
      longitude: currentCoordinates.longitude,
      accuracy: currentCoordinates.accuracy,
      motivo: motivo,
      foto: photoBlob,
      fotoNome: photoBlob ? photoBlob.name : null,
      fotoTipo: photoBlob ? photoBlob.type : null,
      timestamp: new Date().toISOString(),
    };

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.add(novoPonto);

    request.onsuccess = (event) => {
      const pontoId = event.target.result;
      novoPonto.id = pontoId;
      showMessage("Ponto registrado com sucesso localmente!", "success");
      addPontoToListDOM(novoPonto, pontoId);
      addMarkerToMap(novoPonto);
      motivoInput.value = "";
      fotoInput.value = "";
      getGPSLocation();
    };

    request.onerror = (event) => {
      showError("Erro ao salvar o ponto localmente.");
      console.error("Error saving point:", event);
    };
    hideLoading();
  }

  function addPontoToListDOM(ponto, id) {
    if (nenhumPontoRegistradoLi) {
      nenhumPontoRegistradoLi.style.display = "none";
    }

    const listItem = document.createElement("li");
    listItem.className =
      "list-group-item d-flex justify-content-between align-items-center";
    listItem.dataset.id = id;

    let photoInfo = ponto.fotoNome
      ? `<span class="badge bg-secondary"><i class="bi bi-camera-fill"></i> ${ponto.fotoNome}</span>`
      : '<span class="badge bg-light text-dark">Sem foto</span>';

    listItem.innerHTML = `
            <div>
                <strong>Motivo:</strong> ${ponto.motivo}<br>
                <small>Lat: ${ponto.latitude.toFixed(
                  4
                )}, Lon: ${ponto.longitude.toFixed(4)}</small><br>
                <small>Registrado em: ${new Date(
                  ponto.timestamp
                ).toLocaleString()}</small>
            </div>
            <div>
                ${photoInfo}
                <button class="btn btn-sm btn-danger ms-2 btn-remover-ponto" data-id="${id}"><i class="bi bi-trash"></i></button>
            </div>
        `;
    listaPontosRegistrados.appendChild(listItem);

    listItem
      .querySelector(".btn-remover-ponto")
      .addEventListener("click", function () {
        removerPonto(id, listItem);
      });
  }

  function addMarkerToMap(ponto) {
    if (!inspectionMap || !ponto.latitude || !ponto.longitude) return;

    const marker = L.marker([ponto.latitude, ponto.longitude])
      .addTo(inspectionMap)
      .bindPopup(
        `<b>Motivo:</b> ${ponto.motivo}<br><b>Registrado em:</b> ${new Date(
          ponto.timestamp
        ).toLocaleTimeString()}`
      );

    mapMarkers[ponto.id] = marker;

    inspectionMap.setView([ponto.latitude, ponto.longitude], 16);
  }

  function removerPonto(id, listItemElement) {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      listItemElement.remove();
      removeMarkerFromMap(id);
      showMessage("Ponto removido.", "info");
      if (
        listaPontosRegistrados.children.length === 0 ||
        (listaPontosRegistrados.children.length === 1 &&
          listaPontosRegistrados.firstChild.id === "nenhum-ponto-registrado")
      ) {
        if (nenhumPontoRegistradoLi)
          nenhumPontoRegistradoLi.style.display = "block";
      }
    };
    request.onerror = (event) => {
      showError("Erro ao remover o ponto.");
      console.error("Error deleting point:", event);
    };
  }

  function removeMarkerFromMap(pontoId) {
    if (mapMarkers[pontoId]) {
      inspectionMap.removeLayer(mapMarkers[pontoId]);
      delete mapMarkers[pontoId];
    }
  }

  function loadPontosFromDB() {
    if (!db) return;
    const transaction = db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
      const pontos = event.target.result;
      listaPontosRegistrados.innerHTML = "";
      if (inspectionMap) {
        Object.values(mapMarkers).forEach((marker) =>
          inspectionMap.removeLayer(marker)
        );
      }
      mapMarkers = {};

      if (pontos.length === 0 && nenhumPontoRegistradoLi) {
        listaPontosRegistrados.appendChild(nenhumPontoRegistradoLi);
        nenhumPontoRegistradoLi.style.display = "block";
      } else if (nenhumPontoRegistradoLi) {
        nenhumPontoRegistradoLi.style.display = "none";
        listaPontosRegistrados.appendChild(nenhumPontoRegistradoLi);
      }

      const bounds = L.latLngBounds();
      pontos.forEach((ponto) => {
        addPontoToListDOM(ponto, ponto.id);
        if (inspectionMap && ponto.latitude && ponto.longitude) {
          const marker = L.marker([ponto.latitude, ponto.longitude])
            .addTo(inspectionMap)
            .bindPopup(
              `<b>Motivo:</b> ${
                ponto.motivo
              }<br><b>Registrado em:</b> ${new Date(
                ponto.timestamp
              ).toLocaleTimeString()}`
            );
          mapMarkers[ponto.id] = marker;
          bounds.extend([ponto.latitude, ponto.longitude]);
        }
      });

      if (inspectionMap && pontos.length > 0 && bounds.isValid()) {
        inspectionMap.fitBounds(bounds, { padding: [50, 50] });
      } else if (inspectionMap && pontos.length === 0 && currentCoordinates) {
        inspectionMap.setView(
          [currentCoordinates.latitude, currentCoordinates.longitude],
          15
        );
      } else if (inspectionMap && pontos.length === 0) {
        inspectionMap.setView([-15.7801, -47.9292], 5);
      }
    };
    request.onerror = (event) => {
      showError("Erro ao carregar pontos do banco de dados local.");
      console.error("Error loading points:", event);
    };
  }

  async function exportarInspecao() {
    if (!db) {
      showError("Banco de dados não inicializado.");
      return;
    }
    showLoading("Preparando dados para exportação...");

    const transaction = db.transaction([STORE_NAME], "readonly");
    const objectStore = transaction.objectStore(STORE_NAME);
    const getAllRequest = objectStore.getAll();

    getAllRequest.onsuccess = async (event) => {
      const pontos = event.target.result;
      if (pontos.length === 0) {
        showMessage("Nenhum ponto registrado para exportar.", "warning");
        hideLoading();
        return;
      }

      const format = prompt("Exportar como 'geojson' ou 'kmz'?", "kmz");

      if (format && format.toLowerCase() === "geojson") {
        exportToGeoJSON(pontos);
      } else if (format && format.toLowerCase() === "kmz") {
        await exportToKMZ(pontos);
      } else if (format !== null) {
        showError("Formato de exportação inválido. Use 'geojson' ou 'kmz'.");
      }
      hideLoading();
    };
    getAllRequest.onerror = (event) => {
      showError("Erro ao ler dados para exportação.");
      console.error("Export error (getAll):", event);
      hideLoading();
    };
  }

  function exportToGeoJSON(points) {
    const geojsonData = {
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
        properties: {
          id: point.id,
          motivo: point.motivo,
          timestamp: point.timestamp,
          accuracy: point.accuracy,
          photo_attached: !!point.fotoNome,
          photo_filename: point.fotoNome || null,
        },
      })),
    };

    const dataStr = JSON.stringify(geojsonData, null, 2);
    const blob = new Blob([dataStr], { type: "application/geo+json" });
    saveAs(blob, `inspecao_pontos_${Date.now()}.geojson`);
    showMessage("Dados exportados como GeoJSON!", "success");
  }

  async function exportToKMZ(points) {
    const zip = new JSZip();
    let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Pontos de Inspeção</name>
    <Style id="inspectionPointStyle">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/ms/icons/red-dot.png</href>
        </Icon>
      </IconStyle>
    </Style>`;

    const imagesFolder = zip.folder("images");

    for (const point of points) {
      let description = `<![CDATA[
                <p><strong>Motivo:</strong> ${point.motivo}</p>
                <p><strong>Timestamp:</strong> ${new Date(
                  point.timestamp
                ).toLocaleString()}</p>
                <p><strong>Coordenadas:</strong> ${point.latitude.toFixed(
                  6
                )}, ${point.longitude.toFixed(6)}</p>
                <p><strong>Precisão GPS:</strong> ${
                  point.accuracy ? point.accuracy.toFixed(1) + "m" : "N/A"
                }</p>`;

      if (point.foto && point.fotoNome) {
        const photoFilename = `img_${point.id}_${point.fotoNome.replace(
          /[^a-zA-Z0-9.]/g,
          "_"
        )}`;
        imagesFolder.file(photoFilename, point.foto);
        description += `<p><img src="images/${photoFilename}" alt="Foto da Inspeção" style="max-width:300px; max-height:300px;" /></p>`;
      }
      description += `]]>`;

      kmlContent += `
    <Placemark>
      <name>Ponto ${point.id}: ${point.motivo.substring(0, 30)}</name>
      <styleUrl>#inspectionPointStyle</styleUrl>
      <description>${description}</description>
      <Point>
        <coordinates>${point.longitude},${point.latitude},0</coordinates>
      </Point>
    </Placemark>`;
    }

    kmlContent += `
  </Document>
</kml>`;

    zip.file("doc.kml", kmlContent);

    try {
      const kmzBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.google-earth.kmz",
      });
      saveAs(kmzBlob, `inspecao_pontos_${Date.now()}.kmz`);
      showMessage("Dados exportados como KMZ!", "success");
    } catch (err) {
      showError("Erro ao gerar o arquivo KMZ.");
      console.error("KMZ generation error:", err);
    }
  }

  btnRegistrarPonto.addEventListener("click", registrarPonto);
  btnExportarInspecao.addEventListener("click", exportarInspecao);

  initDB()
    .then(() => {
      initInspectionMap();
      loadPontosFromDB();
      getGPSLocation();
    })
    .catch((err) => {
      showError(
        "Falha crítica ao iniciar o banco de dados local. A aplicação pode não funcionar corretamente."
      );
      initInspectionMap();
      getGPSLocation();
    });
});
