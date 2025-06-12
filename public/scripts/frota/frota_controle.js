<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Controle da Frota</title>
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/icon?family=Material+Icons"
      rel="stylesheet"
    />
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/css/frota_controle.css" />
    <link rel="stylesheet" href="/static/css/toast.css" />
    </head>

  <body>
    <div class="sidebar">
      <div class="sidebar-header text-center pt-3 pb-2">
        <i class="material-icons user-icon" style="font-size: 4.5rem; color: rgba(255,255,255,0.95);">account_circle</i>
        <h5 id="user-name" class="text-white mt-1 mb-0" style="font-weight: 500;">Carregando...</h5>
      </div>
      <div class="user-details-block px-3 py-2 mx-2 mb-2" style="background: rgba(0,0,0,0.15); border-radius: 6px; color: rgba(255,255,255,0.85); font-size: 0.85rem;">
        <p class="mb-1 d-flex align-items-center">
          <i class="material-icons me-2" style="font-size: 1.1rem;">badge</i>
          Matrícula: <span id="user-matricula" class="ms-1">Carregando...</span>
        </p>
        <p class="mb-0 d-flex align-items-center">
          <i class="material-icons me-2" style="font-size: 1.1rem;">work_outline</i>
          Cargo: <span id="user-cargo" class="ms-1">Carregando...</span>
        </p>
      </div>
      <ul class="list-unstyled components flex-grow-1 px-1">
        <li>
          <a href="/"><i class="material-icons">home</i> Início</a>
        </li>
        <li>
          <a href="/dashboard"
            ><i class="material-icons">dashboard</i> Dashboard</a
          >
        </li>
        <li>
          <a href="/frota" ><i class="material-icons">arrow_back</i> Voltar para Frota</a
          >
        </li>
      </ul>
      <div class="sidebar-footer text-center py-3 px-2 mt-auto">
        <button id="logoutButton" class="btn btn-danger w-100 d-flex align-items-center justify-content-center">
          <i class="material-icons me-2">logout</i>Sair
        </button>
      </div>
    </div>

    <div class="content">
      <div class="container-fluid">
        <h1 class="page-title">Controle da Frota</h1>
        <p class="lead text-muted mb-4">
          Selecione uma das áreas abaixo para gerenciar os cadastros e o
          inventário.
        </p>

        <div class="row">
          <div class="col-lg-4 col-md-6 mb-4">
            <a href="/frota_veiculos_cadastro" class="text-decoration-none">
              <div class="card action-card">
                <div class="card-body p-4">
                  <div class="icon-circle bg-primary">
                    <i class="material-icons">directions_car</i>
                  </div>
                  <h5 class="card-title">Veículos</h5>
                  <p class="card-text">
                    Cadastre, edite e consulte os veículos da frota.
                  </p>
                </div>
              </div>
            </a>
          </div>

          <div class="col-lg-4 col-md-6 mb-4">
            <a href="/frota_motoristas_cadastro" class="text-decoration-none">
              <div class="card action-card">
                <div class="card-body p-4">
                  <div class="icon-circle bg-success">
                    <i class="material-icons">badge</i>
                  </div>
                  <h5 class="card-title">Motoristas</h5>
                  <p class="card-text">
                    Gerencie os motoristas, matrículas e informações.
                  </p>
                </div>
              </div>
            </a>
          </div>

          <div class="col-lg-4 col-md-6 mb-4">
            <a href="/frota_estoque_cadastro" class="text-decoration-none">
              <div class="card action-card">
                <div class="card-body p-4">
                  <div class="icon-circle bg-warning">
                    <i class="material-icons">inventory_2</i>
                  </div>
                  <h5 class="card-title">Estoque de Peças</h5>
                  <p class="card-text">
                    Controle o inventário de peças e suprimentos.
                  </p>
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="/scripts/sidebar.js"></script>
    <script src="/scripts/frota/frota_controle.js"></script>
  </body>
</html>