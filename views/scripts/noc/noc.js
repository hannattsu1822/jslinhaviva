document.addEventListener("DOMContentLoaded", () => {
    // Relógio
    setInterval(() => {
        const now = new Date();
        document.getElementById("clock").textContent = now.toLocaleTimeString("pt-BR");
    }, 1000);

    // Configurações de Limite
    const LIMITS = {
        WARNING: 55.0,
        CRITICAL: 60.0
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

        // Extrair temperatura (usando lógica simplificada aqui, mas idealmente igual ao helper)
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

        // Prioridade: Temperatura do Enrolamento > Dispositivo > Ambiente
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

        // Atualiza Valor
        valEl.textContent = parseFloat(valor).toFixed(1);

        // Atualiza Hora
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Atualiza Status Visual (Cores)
        card.className = "device-card"; // Reset classes
        
        if (valor >= LIMITS.CRITICAL) {
            card.classList.add("status-critical");
            statusEl.innerHTML = '<span class="status-dot bg-danger"></span> Crítico';
        } else if (valor >= LIMITS.WARNING) {
            card.classList.add("status-warning");
            statusEl.innerHTML = '<span class="status-dot bg-warning"></span> Atenção';
        } else {
            card.classList.add("status-normal");
            statusEl.innerHTML = '<span class="status-dot bg-online"></span> Online';
        }

        // Animação de Flash
        card.classList.remove("updated");
        void card.offsetWidth; // Trigger reflow
        card.classList.add("updated");

        // Watchdog (Offline detection)
        if (watchdog[`${tipo}-${id}`]) clearTimeout(watchdog[`${tipo}-${id}`]);
        
        watchdog[`${tipo}-${id}`] = setTimeout(() => {
            card.className = "device-card status-offline";
            statusEl.innerHTML = '<span class="status-dot bg-offline"></span> Offline';
            valEl.textContent = "--";
        }, 180000); // 3 minutos sem dados = Offline
    }

    conectarWebSocket();
});
