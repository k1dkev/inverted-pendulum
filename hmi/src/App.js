import "./App.css";
import ChartPlot from "./components/ChartPlot/ChartPlot";
import BasicTextOutput from "./components/BasicTextOutput/BasicTextOutput";
import { useRef } from "react";
import Toggle from "./components/Toggle/Toggle";
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
        <div className="box">
          <div className="box-column">
            <div className="box2">
              <button className="button button1">Green</button>
            </div>
            <div className="box2">
              <div className="box-row">
                <p style={{ margin: 0, marginRight: 10 }}>Simulation</p>
                <Toggle />
              </div>
            </div>
            <div className="box2">
              <div className="box-row">
                <RadioText />
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
