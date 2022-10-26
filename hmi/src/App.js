import "./App.css";
// import ChartPlot from "./components/ChartPlot/ChartPlot";
import BasicTextOutput from "./components/BasicTextOutput/BasicTextOutput";
import { useRef, useEffect, useState } from "react";
import NiceButton from "./components/NiceButton/NiceButton";
import RadioText from "./components/RadioText/RadioText";
import PendCanvas from "./components/PendCanvas/PendCanvas";
// import ChartCanvas from "./components/ChartCanvas/ChartCanvas";
import { kChart } from "./components/kChart/kChart";
// import Canvas from "./components/Canvas/Canvas";
import Canvas from "./components/CanvasCtx/Canvas";
import { kData } from "./components/kChart/kData";

function App() {
  // var x;
  const BasicTextRef = useRef(null);
  const handlePendCanvasData = (data) => {
    if (data) {
      // x = data.x || 0;
      BasicTextRef.current.updateValue(data.u || 0);
    } else {
      // x = 0;
      BasicTextRef.current.updateValue(0);
    }
  };

  const canvasRef = useRef(null);
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    const chart = new kChart(ctx);
    const data = new kData();
    const xAxis = chart.createAxis();
    const yAxis = chart.createAxis();
    const pen = chart.createPen(data, xAxis, yAxis);
    const render = () => {
      chart.draw();
      window.requestAnimationFrame(render);
    };
    render();
  }, []);
  // const getData = () => {
  //   return x ? x[0] : 0;
  // };
  // var chart = new kChart();
  // const data = new kData({ label: "x", maxNumOfPoints: 500 });
  // const xAxis = chart.createAxis({ border: { show: true, color: "#008000" } });
  // const yAxis = chart.createAxis({ border: { show: true } });
  // chart.createPen({}, data, xAxis, yAxis);

  return (
    <>
      <div className="container">
        {/* Row 1 */}
        <div className="row">
          <div className="box">
            <PendCanvas passDataToParent={handlePendCanvasData} />
          </div>
          <div className="box">{/* <ChartPlot getData={getData} /> */}</div>
        </div>

        {/* Row 2 */}
        <div className="row">
          <div className="box">
            <p>u value output</p>
            <BasicTextOutput ref={BasicTextRef} />
          </div>
          <div className="box">
            <p>TestCanvas</p>
            <Canvas canvasRef={canvasRef} />
          </div>
        </div>

        {/* Row 3 */}
        <div className="row">
          <div className="box">
            <div className="row">
              <div className="column">
                <p className="p-text">Simulation</p>
              </div>
              <div className="column">
                <RadioText label1="On" label2="Off" />
              </div>
            </div>
            <div className="row">
              <div className="column">
                <p style={{ margin: 0, marginRight: 10 }}>Mode</p>
              </div>
              <div className="column">
                <RadioText className="right" label1="Auto" label2="Manual" />
              </div>
            </div>
            <div className="row">
              <div className="column">
                <p style={{ margin: 0, marginRight: 10 }}>Run</p>
              </div>
              <div className="column">
                <div className="row">
                  <div className="container">
                    <NiceButton name="Start" color="green" />
                  </div>
                  <div className="container">
                    <NiceButton name="Stop" color="red" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="box">{/* <ChartCanvas /> */}</div>
        </div>
      </div>
    </>
  );
}

export default App;
