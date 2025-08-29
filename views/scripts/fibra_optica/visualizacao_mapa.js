document.addEventListener("DOMContentLoaded", () => {
  const mapElement = document.getElementById('map');
  if (!mapElement) {
    console.error("Elemento do mapa não encontrado!");
    return;
  }

  const map = L.map('map').setView([-14.235, -51.925], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const allMarkers = {}; // Objeto para armazenar todos os marcadores, agrupados por tipo

  // --- LÓGICA DE FILTROS ---
  const filterContainer = document.getElementById('map-filter-container');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');

  const applyMapFilter = () => {
    const selectedTypes = new Set();
    filterContainer.querySelectorAll('.filter-checkbox:checked').forEach(checkbox => {
      selectedTypes.add(checkbox.value);
    });

    let visibleMarkersBounds = [];

    for (const type in allMarkers) {
      allMarkers[type].forEach(marker => {
        if (selectedTypes.has(type)) {
          marker.addTo(map);
          visibleMarkersBounds.push(marker.getLatLng());
        } else {
          marker.removeFrom(map);
        }
      });
    }
    
    if (visibleMarkersBounds.length > 0) {
        map.fitBounds(L.latLngBounds(visibleMarkersBounds), { padding: [50, 50] });
    }
  };

  filterContainer.addEventListener('change', applyMapFilter);

  selectAllBtn.addEventListener('click', () => {
    filterContainer.querySelectorAll('.filter-checkbox').forEach(checkbox => checkbox.checked = true);
    applyMapFilter();
  });

  deselectAllBtn.addEventListener('click', () => {
    filterContainer.querySelectorAll('.filter-checkbox').forEach(checkbox => checkbox.checked = false);
    applyMapFilter();
  });
  // --- FIM DA LÓGICA DE FILTROS ---

  const measureToolBtn = document.getElementById('measure-tool-btn');
  let isMeasuring = false;
  let measureFirstPoint = null;
  let measurementLayer = L.layerGroup().addTo(map);

  const startMeasureTool = () => {
    stopRouteTool();
    isMeasuring = true;
    measurementLayer.clearLayers();
    measureFirstPoint = null;
    measureToolBtn.classList.add('active', 'btn-danger');
    measureToolBtn.classList.remove('btn-info');
    measureToolBtn.innerHTML = '<i class="fa-solid fa-xmark me-2"></i>Cancelar Medição';
    mapElement.style.cursor = 'crosshair';
  };

  const stopMeasureTool = () => {
    isMeasuring = false;
    measureFirstPoint = null;
    measureToolBtn.classList.remove('active', 'btn-danger');
    measureToolBtn.classList.add('btn-info');
    measureToolBtn.innerHTML = '<i class="fa-solid fa-ruler-horizontal me-2"></i>Medir Vão';
    mapElement.style.cursor = '';
  };

  measureToolBtn.addEventListener('click', () => {
    if (isMeasuring) {
      stopMeasureTool();
      measurementLayer.clearLayers();
    } else {
      startMeasureTool();
    }
  });

  const routeToolBtn = document.getElementById('route-tool-btn');
  const routePanel = document.getElementById('route-panel');
  const routeInfo = document.getElementById('route-info');
  const generateMapsRouteBtn = document.getElementById('generate-maps-route-btn');
  let isRouting = false;
  let routeWaypoints = [];
  let routeLayer = L.layerGroup().addTo(map);

  const startRouteTool = () => {
    stopMeasureTool();
    isRouting = true;
    routeWaypoints = [];
    routeLayer.clearLayers();
    routePanel.classList.remove('d-none');
    routeToolBtn.classList.add('active', 'btn-danger');
    routeToolBtn.classList.remove('btn-success');
    routeToolBtn.innerHTML = '<i class="fa-solid fa-xmark me-2"></i>Cancelar Rota';
    mapElement.style.cursor = 'pointer';
    updateRoutePanel();
  };

  const stopRouteTool = () => {
    isRouting = false;
    routePanel.classList.add('d-none');
    routeToolBtn.classList.remove('active', 'btn-danger');
    routeToolBtn.classList.add('btn-success');
    routeToolBtn.innerHTML = '<i class="fa-solid fa-road me-2"></i>Criar Rota';
    mapElement.style.cursor = '';
  };
  
  const updateRoutePanel = () => {
    let totalDistance = 0;
    for (let i = 1; i < routeWaypoints.length; i++) {
      totalDistance += routeWaypoints[i-1].distanceTo(routeWaypoints[i]);
    }
    routeInfo.textContent = `Pontos: ${routeWaypoints.length} | Distância Total: ${totalDistance.toFixed(2)} m`;
    generateMapsRouteBtn.disabled = routeWaypoints.length < 2;
  };

  routeToolBtn.addEventListener('click', () => {
    if (isRouting) {
      stopRouteTool();
      routeLayer.clearLayers();
    } else {
      startRouteTool();
    }
  });

  generateMapsRouteBtn.addEventListener('click', () => {
    if (routeWaypoints.length < 2) return;
    const origin = routeWaypoints[0];
    const destination = routeWaypoints[routeWaypoints.length - 1];
    const waypoints = routeWaypoints.slice(1, -1).map(wp => `${wp.lat},${wp.lng}`).join('|');
    
    let mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
    if (waypoints) {
      mapsUrl += `&waypoints=${waypoints}`;
    }
    window.open(mapsUrl, '_blank');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
      if (isMeasuring) { stopMeasureTool(); measurementLayer.clearLayers(); }
      if (isRouting) { stopRouteTool(); routeLayer.clearLayers(); }
    }
  });

  const getPontoIcon = (tipo) => {
    let iconName = 'fa-question-circle', markerColor = 'gray';
    switch (tipo) {
      case 'Cliente': iconName = 'fa-user'; markerColor = 'blue'; break;
      case 'Caixa de Emenda': iconName = 'fa-inbox'; markerColor = 'darkred'; break;
      case 'Poste': iconName = 'fa-bolt'; markerColor = 'orange'; break;
      case 'Reserva': iconName = 'fa-circle-nodes'; markerColor = 'green'; break;
      default: iconName = 'fa-map-marker-alt'; markerColor = 'cadetblue'; break;
    }
    return L.AwesomeMarkers.icon({ icon: iconName, markerColor: markerColor, prefix: 'fa', iconColor: 'white' });
  };

  const fetchAndDrawPoints = async () => {
    try {
      const response = await fetch('/api/fibra/todos-os-pontos');
      if (!response.ok) throw new Error('Falha ao carregar os pontos do mapa.');
      const pontos = await response.json();

      if (pontos.length > 0) {
        pontos.forEach(ponto => {
          const lat = parseFloat(ponto.latitude);
          const lon = parseFloat(ponto.longitude);

          if (!isNaN(lat) && !isNaN(lon)) {
            const customIcon = getPontoIcon(ponto.tipo_ponto);
            const marker = L.marker([lat, lon], { icon: customIcon });
            
            if (!allMarkers[ponto.tipo_ponto]) {
              allMarkers[ponto.tipo_ponto] = [];
            }
            allMarkers[ponto.tipo_ponto].push(marker);
            
            marker.on('click', () => {
              const currentLatLng = L.latLng(lat, lon);
              if (isMeasuring) {
                if (!measureFirstPoint) {
                  measureFirstPoint = { latlng: currentLatLng };
                  L.circleMarker(measureFirstPoint.latlng, { radius: 8, color: '#0dcaf0', fillOpacity: 0.8 }).addTo(measurementLayer);
                } else {
                  const distance = measureFirstPoint.latlng.distanceTo(currentLatLng);
                  L.polyline([measureFirstPoint.latlng, currentLatLng], { color: '#0dcaf0', weight: 3 }).addTo(measurementLayer)
                    .bindTooltip(`${distance.toFixed(2)} metros`, { permanent: true, className: 'measurement-tooltip' }).openTooltip();
                  stopMeasureTool();
                }
              } else if (isRouting) {
                routeWaypoints.push(currentLatLng);
                L.circleMarker(currentLatLng, { radius: 6, color: '#198754', fillOpacity: 0.7 }).addTo(routeLayer);
                if (routeWaypoints.length > 1) {
                  L.polyline([routeWaypoints[routeWaypoints.length - 2], currentLatLng], { color: '#198754', weight: 4, opacity: 0.7 }).addTo(routeLayer);
                }
                updateRoutePanel();
              }
            });

            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
            const popupContent = `
              <div style="font-family: Arial, sans-serif; font-size: 14px;">
                <b>Tipo:</b> ${ponto.tipo_ponto}<br>
                <b>TAG:</b> ${ponto.tag}<br>
                <b>Localização (Lat/Lon):</b><br>
                <small>Lat: ${lat.toFixed(6)}</small><br>
                <small>Lon: ${lon.toFixed(6)}</small>
                <hr style="margin: 8px 0;">
                <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm w-100">
                  <i class="fa-solid fa-route me-2"></i>Criar Rota
                </a>
              </div>
            `;
            
            marker.bindPopup(popupContent);
          }
        });
        
        applyMapFilter(); // Aplica o filtro inicial (todos marcados)
      } else {
        showToast("Nenhum ponto de mapa encontrado para exibir.", "info");
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    }
  };

  fetchAndDrawPoints();
});
