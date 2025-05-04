// Função para logout
function logout() {
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Atualizar data e hora
function updateDateTime() {
    const now = new Date();
    document.getElementById('current-date').textContent = now.toLocaleDateString('pt-BR');
}

// Inicialização da Sidebar
document.addEventListener('DOMContentLoaded', function() {
    // Recupera os dados do usuário do localStorage
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        document.getElementById('user-name-sidebar').textContent = user.nome;
        document.getElementById('user-cargo-sidebar').textContent = user.cargo;
        document.getElementById('user-matricula').textContent = `Matrícula: ${user.matricula}`;

        // Atualiza data e hora
        updateDateTime();
        setInterval(updateDateTime, 1000);
    } else {
        window.location.href = '/';
    }
});