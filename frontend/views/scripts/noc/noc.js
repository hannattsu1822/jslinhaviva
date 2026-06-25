document.addEventListener("DOMContentLoaded", () => {
    // Relógio
    setInterval(() => {
        const now = new Date();
        document.getElementById("clock").textContent = now.toLocaleTimeString("pt-BR");
    }, 1000);

    // --- CONFIGURAÇÃO DE LIMITES ATUALIZADA ---
    const LIMITS = {
        WARNING: 60.0,  // Atenção começa em 60
        CRITICAL: 70.0  // Crítico começa em 70
    };

    // Timers para detectar offline
    const watchdog = {}; 

    function conectarWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => console.log("NOC Conectado ao WebSocket");
        
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                
                if (msg.type === "nova_leitura_logbox" || msg.type === "nova_leitura") {
                    atualizarLogBox(msg.dados);
                } else if (msg.type === "nova_leitura_rele") {
                    atualizarRele(msg.dados);
                }
            } catch (e) { console.error(e); }
        };

        ws.onclose = () => setTimeout(conectarWebSocket, 5000);
    }

    function atualizarLogBox(dados) {
        const id = dados.serial_number;
        const card = document.getElementById(`card-logbox-${id}`);
        if (!card) return;

        let temp = dados.ch_analog_1;
        if (temp === undefined && dados.value_channels) temp = dados.value_channels[2];
        if (temp === undefined) temp = dados.temperature;

        if (temp !== undefined && temp !== null) {
            atualizarCard(card, id, temp, "logbox");
        }
    }

    function atualizarRele(dados) {
        const id = dados.rele_id;
        const card = document.getElementById(`card-rele-${id}`);
        if (!card) return;

        let temp = dados.temperatura_enrolamento;
        if (temp === undefined || temp === null) temp = dados.temperatura_dispositivo;
        if (temp === undefined || temp === null) temp = dados.temperatura_ambiente;

        if (temp !== undefined && temp !== null) {
            atualizarCard(card, id, temp, "rele");
        }
    }

    function atualizarCard(card, id, valor, tipo) {
        const valEl = document.getElementById(`val-${tipo}-${id}`);
        const statusEl = document.getElementById(`status-${tipo}-${id}`);
        const timeEl = document.getElementById(`time-${tipo}-${id}`);

        valEl.textContent = parseFloat(valor).toFixed(1);

        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Reset classes
        card.className = "device-card"; 
        
        // --- LÓGICA DE CORES ATUALIZADA ---
        if (valor >= LIMITS.CRITICAL) {
            // Maior ou igual a 70
            card.classList.add("status-critical");
            statusEl.innerHTML = '<span class="status-dot bg-danger"></span> Crítico';
        } else if (valor >= LIMITS.WARNING) {
            // Entre 60 e 69.9
            card.classList.add("status-warning");
            statusEl.innerHTML = '<span class="status-dot bg-warning"></span> Atenção';
        } else {
            // Menor que 60
            card.classList.add("status-normal");
            statusEl.innerHTML = '<span class="status-dot bg-online"></span> Online';
        }

        card.classList.remove("updated");
        void card.offsetWidth; 
        card.classList.add("updated");

        if (watchdog[`${tipo}-${id}`]) clearTimeout(watchdog[`${tipo}-${id}`]);
        
        watchdog[`${tipo}-${id}`] = setTimeout(() => {
            card.className = "device-card status-offline";
            statusEl.innerHTML = '<span class="status-dot bg-offline"></span> Offline';
            valEl.textContent = "--";
        }, 180000); 
    }

    conectarWebSocket();
});
