export function showLoading(mensagem = 'Carregando...') {
    const loadingElement = document.getElementById('mapa-loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
        loadingElement.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Carregando...</span>
            </div>
            <span class="ms-2">${mensagem}</span>
        `;
    }
}

export function hideLoading() {
    const loadingElement = document.getElementById('mapa-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

export function showError(mensagem) {
    showMessage(mensagem, 'danger');
}

export function showMessage(mensagem, tipo = 'info') {
    const messagesContainer = document.getElementById('mapa-messages');
    if (!messagesContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    messagesContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 5000);
}

export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'class') {
            element.className = value;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else {
            element[key] = value;
        }
    });
    
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child) {
            element.appendChild(child);
        }
    });
    
    return element;
}

export function parseHTMLDescription(htmlString) {
    if (!htmlString) return {};
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const tables = doc.querySelectorAll('table');
    
    const result = {};
    
    tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 2) {
                const key = cells[0].textContent.trim().toLowerCase();
                const value = cells[1].textContent.trim();
                if (key && value) {
                    result[key] = value;
                }
            }
        });
    });
    
    return result;
}