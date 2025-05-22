require("dotenv").config();

const { app } = require("./init");

const aggregatorRoutes = require("./routes");

app.use("/", aggregatorRoutes);

// Iniciar o servidor
const port = process.env.SERVER_PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
