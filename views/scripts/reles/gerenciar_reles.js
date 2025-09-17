document.addEventListener('DOMContentLoaded', () => {
    const btnAddRele = document.getElementById('btn-add-rele');
    const modal = document.getElementById('rele-modal');
    const closeModalButton = modal.querySelector('.close-button');
    const cancelModalButton = document.getElementById('btn-cancel');
    const releForm = document.getElementById('rele-form');
    const modalTitle = document.getElementById('modal-title');
    const tableBody = document.getElementById('reles-table-body');

    const abrirModal = (rele = null) => {
        releForm.reset();
        document.getElementById('rele-id').value = '';

        if (rele) {
            modalTitle.textContent = 'Editar Relé';
            document.getElementById('rele-id').value = rele.id;
            document.getElementById('nome_rele').value = rele.nome_rele;
            document.getElementById('local_tag').value = rele.local_tag;
            document.getElementById('ip_address').value = rele.ip_address;
            document.getElementById('port').value = rele.port;
            document.getElementById('ativo').checked = rele.ativo;
        } else {
            modalTitle.textContent = 'Adicionar Novo Relé';
            document.getElementById('ativo').checked = true;
        }
        modal.style.display = 'block';
    };

    const fecharModal = () => {
        modal.style.display = 'none';
    };

    btnAddRele.addEventListener('click', () => abrirModal());
    closeModalButton.addEventListener('click', fecharModal);
    cancelModalButton.addEventListener('click', fecharModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            fecharModal();
        }
    });

    async function carregarReles() {
        try {
            const response = await fetch('/api/reles');
            if (!response.ok) {
                throw new Error('Falha ao buscar dados dos relés.');
            }
            const reles = await response.json();
            
            tableBody.innerHTML = '';

            if (reles.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 6;
                td.textContent = 'Nenhum relé cadastrado.';
                td.style.textAlign = 'center';
                tr.appendChild(td);
                tableBody.appendChild(tr);
                return;
            }

            reles.forEach(rele => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${rele.nome_rele}</td>
                    <td>${rele.local_tag || 'N/A'}</td>
                    <td>${rele.ip_address}</td>
                    <td>${rele.port}</td>
                    <td>
                        <span class="status-badge ${rele.ativo ? 'ativo' : 'inativo'}">
                            ${rele.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </td>
                    <td class="action-buttons">
                        <button class="btn-icon btn-edit" title="Editar"><span class="material-icons">edit</span></button>
                        <button class="btn-icon btn-delete" title="Excluir"><span class="material-icons">delete</span></button>
                    </td>
                `;
                
                tr.querySelector('.btn-edit').addEventListener('click', () => abrirModal(rele));
                tr.querySelector('.btn-delete').addEventListener('click', () => deletarRele(rele.id, rele.nome_rele));

                tableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Erro ao carregar relés:', error);
            alert('Não foi possível carregar os relés. Verifique o console para mais detalhes.');
        }
    }

    releForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const id = document.getElementById('rele-id').value;
        const releData = {
            nome_rele: document.getElementById('nome_rele').value,
            local_tag: document.getElementById('local_tag').value,
            ip_address: document.getElementById('ip_address').value,
            port: document.getElementById('port').value,
            ativo: document.getElementById('ativo').checked,
        };

        const isEditing = !!id;
        const url = isEditing ? `/api/reles/${id}` : '/api/reles';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(releData),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Ocorreu um erro ao salvar o relé.');
            }

            alert(`Relé ${isEditing ? 'atualizado' : 'criado'} com sucesso!`);
            fecharModal();
            carregarReles();

        } catch (error) {
            console.error('Erro ao salvar relé:', error);
            alert(error.message);
        }
    });

    async function deletarRele(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir o relé "${nome}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            const response = await fetch(`/api/reles/${id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Ocorreu um erro ao excluir o relé.');
            }

            alert('Relé excluído com sucesso!');
            carregarReles();

        } catch (error) {
            console.error('Erro ao excluir relé:', error);
            alert(error.message);
        }
    }

    carregarReles();
});
