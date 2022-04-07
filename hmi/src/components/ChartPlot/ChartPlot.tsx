import React from "react";
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import "./ChartPlot.css";
Chart.register(...registerables);

const ChartPlot = (props: any) => {
  const { getData } = props;
  const canvasRef = useRef(null);
  function addData(chart: any, label: any, data: any) {
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset: any) => {
      dataset.data.push(data);
    });
  }

  function removeData(chart: any) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset: any) => {
      dataset.data.shift();
    });
  }

  useEffect(() => {
    const canvas: any = canvasRef.current;
    const ctx: any = canvas.getContext("2d");
    const initialTime = new Date();
    const labels: any = [];
    const data: any = {
      labels: labels,
      datasets: [
        {
          label: "My First dataset",
          backgroundColor: "rgb(255, 99, 132)",
          borderColor: "rgb(255, 99, 132)",
          data: [],
          pointRadius: 0,
        },
      ],
    };
    const config: any = {
      type: "line",
      data,
      options: {
        // maintainAspectRatio: false,
        layout: {
          padding: {
            left: 20,
            right: 20,
          },
        },
        scales: {
          yAxis: {
            min: -250,
            max: 250,
          },
          xAxis: {
            type: "time",
            time: {
              unit: "second",
              displayFormats: {
                second: "mm:ss",
              },
            },
          },
        },
      },
    };

    const myChart = new Chart(ctx, config);

    var cnt = 0;

    setInterval(function () {
      let currentTime = new Date();
      let deltaTime = Number(currentTime) - Number(initialTime);
      addData(myChart, deltaTime, getData());
      cnt++;
      if (cnt > 500) {
        removeData(myChart);
      }
      myChart.update("none");
    }, 15);
  }, [getData]);

  return (
    <div className="chart-container">
      <canvas className="ChartPlotCanvas" ref={canvasRef} />
    </div>
  );
};

export default ChartPlot;
