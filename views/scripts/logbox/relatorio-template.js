if (typeof chartData !== "undefined") {
  const ctx = document.getElementById("report-chart").getContext("2d");
  new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Temperatura (°C)",
          data: chartData.datasets[0].data,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          fill: true,
          tension: 0.1,
        },
      ],
    },
    options: {
      animation: {
        duration: 0,
      },
      responsive: true,
    },
  });
}
