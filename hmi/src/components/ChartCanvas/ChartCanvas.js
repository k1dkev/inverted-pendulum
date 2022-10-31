// import "./App.css";
import Canvas from "../NewCanvas/Canvas";
import { useEffect, useRef } from "react";
import { kChart } from "../kChart/kChart";
import { kData } from "../kChart/kData";

const ChartCanvas = (props) => {
  const { onRequestNewState } = props;

  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const dataRef = useRef(null);
  const stateRef = useRef({ x: 0, theta: 0 });

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    chartRef.current = new kChart(ctx);
    dataRef.current = new kData();
    const xAxis = chartRef.current.createAxis();
    const yAxis = chartRef.current.createAxis();
    chartRef.current.createPen(dataRef.current, xAxis, yAxis);
  }, []);

  const canvasHandler = (t) => {
    stateRef.current = onRequestNewState(t);
    // data.add(stateRef.current)
    chartRef.current.draw(t);
  };

  return <Canvas ref={canvasRef} onRequestFrame={canvasHandler} />;
};

export default ChartCanvas;
