document.addEventListener('DOMContentLoaded', async () => {
    const relesListContainer = document.getElementById('reles-list');
    const loadingMessage = document.getElementById('loading-message');

    try {
        const response = await fetch('/api/reles');
        if (!response.ok) throw new Error('Falha ao buscar relés.');
        
        const reles = await response.json();
        
        if (reles.length > 0) {
            loadingMessage.style.display = 'none';
            const relesAtivos = reles.filter(r => r.ativo);
            if (relesAtivos.length === 0) {
                loadingMessage.textContent = 'Nenhum relé ativo para monitorar.';
                loadingMessage.style.display = 'block';
                return;
            }

            relesAtivos.forEach(rele => {
                const card = document.createElement('div');
                card.className = 'rele-select-card';
                card.innerHTML = `
                    <a href="/visualizar-reles/${rele.id}">
                        <h3><span class="material-icons">bolt</span>${rele.nome_rele}</h3>
                        <p>Tag: ${rele.local_tag || 'N/A'} &bull; IP: ${rele.ip_address}</p>
                    </a>
                `;
                relesListContainer.appendChild(card);
            });
        } else {
            loadingMessage.textContent = 'Nenhum relé cadastrado.';
        }
    } catch (error) {
        console.error('Erro:', error);
        loadingMessage.textContent = 'Erro ao carregar dispositivos.';
    }
});
