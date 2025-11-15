document.addEventListener("DOMContentLoaded", function () {
  // Mapeamento dos cards que exigem um nível de permissão específico.
  const permissionMap = {
    "card-infra-codes": 4, // Nível mínimo para gerenciar a infraestrutura de códigos
  };

  // Busca os dados do usuário logado na API.
  fetch("/api/me")
    .then((response) => {
      if (!response.ok) {
        // Se a resposta não for OK (ex: 401 Unauthorized), redireciona para o login.
        console.error("Usuário não autenticado. Redirecionando para /login");
        window.location.href = "/login";
        return Promise.reject("Usuário não autenticado");
      }
      return response.json();
    })
    .then((user) => {
      if (!user || typeof user.nivel === "undefined") {
        console.error(
          "Nível do usuário não encontrado. Redirecionando para /login"
        );
        window.location.href = "/login";
        return;
      }

      const userLevel = user.nivel;

      // Itera sobre o mapa de permissões para mostrar/ocultar os cards.
      for (const cardId in permissionMap) {
        const requiredLevel = permissionMap[cardId];
        const cardElement = document.getElementById(cardId);

        if (cardElement && userLevel >= requiredLevel) {
          // Se o usuário tem o nível necessário, torna o card visível.
          cardElement.style.display = "block";
        }
      }
    })
    .catch((error) => {
      // Captura erros de rede ou o erro de "Usuário não autenticado".
      console.error("Erro ao buscar dados do usuário:", error);
    });
});
