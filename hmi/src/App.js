import "./App.css";
import ChartPlot from "./components/ChartPlot/ChartPlot";
import BasicTextOutput from "./components/BasicTextOutput/BasicTextOutput";
import { useRef } from "react";
import NiceButton from "./components/NiceButton/NiceButton";
import RadioText from "./components/RadioText/RadioText";
import PendCanvas from "./components/PendCanvas/PendCanvas";

function App() {
  var x;
  const BasicTextRef = useRef(null);
  const handlePendCanvasData = (data) => {
    if (data) {
      x = data.x || 0;
      BasicTextRef.current.updateValue(data.u || 0);
    } else {
      x = 0;
      BasicTextRef.current.updateValue(0);
    }
  };
  const getData = () => {
    return x ? x[0] : 0;
  };

  return (
    <>
      <div className="box-row">
        <div className="box">
          <PendCanvas passDataToParent={handlePendCanvasData} />
        </div>
        <div className="box">
          <ChartPlot getData={getData} />
        </div>
      </div>
      <div className="box-row">
        <div className="box">
          <BasicTextOutput ref={BasicTextRef} />
        </div>
        <div className="box top">
          <div className="box-column">
            <div className="box2">
              <div className="box-row center">
                <p style={{ margin: 0, marginRight: 10 }}>Simulation</p>
                <div className="right">
                  <RadioText label1="On" label2="Off" />
                </div>
              </div>
            </div>
            <div className="box2">
              <div className="box-row center">
                <p style={{ margin: 0, marginRight: 10 }}>Mode</p>
                <div className="right">
                  <RadioText className="right" label1="Auto" label2="Manual" />
                </div>
              </div>
            </div>
            <div className="box2">
              <div className="box-row center">
                <p style={{ margin: 0, marginRight: 10 }}>Run</p>
                <div className="right">
                  <NiceButton name="Start" color="green" />
                  <NiceButton name="Stop" color="red" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="box-row">
        <div className="box">E</div>
        <div className="box">F</div>
      </div>
    </>
  );
}

export default App;
