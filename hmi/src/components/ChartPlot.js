import React from "react";
import { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
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
    const initialTime = new Date();
    // const labels = new Array(500).fill(initialTime - initialTime);
    const labels = [];
    const data = {
      labels: labels,
      datasets: [
        {
          label: "My First dataset",
          backgroundColor: "rgb(255, 99, 132)",
          borderColor: "rgb(255, 99, 132)",
          // data: new Array(500).fill(0),
          data: [],
          pointRadius: 0,
        },
      ],
    };
    const config = {
      type: "line",
      data,
      options: {
        layout: {
          padding: {
            left: 0,
            right: 0,
          },
        },
        scales: {
          yAxis: {
            min: -250,
            max: 250,
          },
          xAxis: {
            // bounds: "data",
            type: "time",
            // time: {
            //   unit: "second",
            // },
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
      let deltaTime = new Date() - initialTime;
      // deltaTime = Number(deltaTime / 1000.0);
      // console.log(deltaTime);
      addData(myChart, deltaTime, getData());
      cnt++;
      if (cnt > 500) {
        removeData(myChart);
      }
      // removeData(myChart);
      myChart.update("none");
    }, 15);
  }, [getData]);

  return <canvas ref={canvasRef} />;
};

export default ChartPlot;
