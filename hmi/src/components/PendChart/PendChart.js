import Canvas from "../Canvas/Canvas";
import { useEffect, useRef } from "react";
import { kChart } from "../kChart/kChart";
import { kData } from "../kChart/kData";

const PendChart = (props) => {
  const { onRequestNewState } = props;
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const dataRef = useRef(null);
  const stateRef = useRef({ x: 0, theta: 0 });

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new kChart(ctx);
    const chart = chartRef.current;
    dataRef.current = new kData();
    const yAxis = chart.createAxis();
    const xAxis = chart.createAxis();
    xAxis.axisType = "x";
    xAxis.borderShow = false;
    xAxis.borderColor = "blue";
    yAxis.axisType = "y";
    yAxis.borderShow = false;
    yAxis.borderColor = "green";
    yAxis.marginBottom = 2;
    chart.graph.borderShow = false;
    chart.graph.borderColor = "black";
    chart.createPen(dataRef.current, xAxis, yAxis);
    // setup interval and get state
  }, []);

  const canvasHandler = (t, deltaTime) => {
    stateRef.current = onRequestNewState(t, deltaTime);
    // data.add(stateRef.current)
    chartRef.current.draw(t);
  };

  return <Canvas ref={canvasRef} onRequestFrame={canvasHandler} />;
};

export default PendChart;
