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

  const getPontoIcon = (tipo) => {
    let iconUrl = '/static/icons/default-marker.png';
    let iconColorClass = '';

    switch (tipo) {
      case 'Cliente':
        iconUrl = '/static/icons/cliente-marker.png';
        iconColorClass = 'marker-cliente';
        break;
      case 'Caixa de Emenda':
        iconUrl = '/static/icons/caixa-marker.png';
        iconColorClass = 'marker-caixa';
        break;
      case 'Poste':
        iconUrl = '/static/icons/poste-marker.png';
        iconColorClass = 'marker-poste';
        break;
      case 'Reserva':
        iconUrl = '/static/icons/reserva-marker.png';
        iconColorClass = 'marker-reserva';
        break;
      default:
        break;
    }

    return L.icon({
      iconUrl: iconUrl,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: iconColorClass
    });
  };

  const fetchAndDrawPoints = async () => {
    try {
      const response = await fetch('/api/fibra/todos-os-pontos');
      if (!response.ok) {
        throw new Error('Falha ao carregar os pontos do mapa.');
      }
      
      const pontos = await response.json();

      if (pontos.length > 0) {
        const bounds = [];
        pontos.forEach(ponto => {
          // --- CORREÇÃO APLICADA AQUI ---
          // Converte as coordenadas de string para número antes de usar
          const lat = parseFloat(ponto.latitude);
          const lon = parseFloat(ponto.longitude);

          if (!isNaN(lat) && !isNaN(lon)) {
            const customIcon = getPontoIcon(ponto.tipo_ponto);
            const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);
            
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
            
            bounds.push([lat, lon]);
          }
        });

        if (bounds.length > 0) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
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
