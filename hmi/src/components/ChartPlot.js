import React from "react";
// import { Chart } from "chart.js";
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
Chart.register(...registerables);

const ChartPlot = (props) => {
  const { getData } = props;
  const canvasRef = useRef(null);

  function addData(chart, label, data) {
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset) => {
      dataset.data.push(data);
    });
    // chart.update("none");
  }

  function removeData(chart) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => {
      dataset.data.shift();
    });
    // chart.update("none");
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const labels = [];
    const data = {
      labels: labels,
      datasets: [
        {
          label: "My First dataset",
          backgroundColor: "rgb(255, 99, 132)",
          borderColor: "rgb(255, 99, 132)",
          data: [],
        },
      ],
    };
    const config = {
      type: "line",
      data,
      options: {},
    };

    const myChart = new Chart(ctx, config);

    var cnt = 0;
    console.log(myChart.data);

    setInterval(function () {
      addData(myChart, cnt, getData());
      cnt++;
      if (cnt > 500) {
        removeData(myChart);
      }
      myChart.update("none");
    }, 15);
  }, [getData]);

  return <canvas ref={canvasRef} />;
};

export default ChartPlot;
