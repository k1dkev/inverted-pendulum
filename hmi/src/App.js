import "./App.css";
// import BasicTextOutput from "./components/BasicTextOutput/BasicTextOutput";
import { useEffect } from "react";
import NiceButton from "./components/NiceButton/NiceButton";
import RadioText from "./components/RadioText/RadioText";
import PendCanvas from "./components/PendCanvas/PendCanvas";
// import PendStateText from "./components/PendStateText/PendStateText";
import useKeys from "./hooks/useKeys";
import ChartCanvas from "./components/ChartCanvas/ChartCanvas";
import usePendSimulation from "./hooks/usePendSimulation";

function App() {
  const keys = useKeys();
  const updatePendState = usePendSimulation();

  const handleResize = (value, e) => {
    // this.setState({
    //   screen: {
    //     width: window.innerWidth,
    //     height: window.innerHeight,
    //     ratio: window.devicePixelRatio || 1,
    //   },
    // });
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
  }, []);

  // const BasicTextRef = useRef(null);

  // const onPendStateChange = (state) => {
  //   // setPendState(state);
  //   BasicTextRef.current.updateValue(state.u);
  // };

  const pendStateHandler = (t) => {
    const pendState = updatePendState(t, keys);
    return { x: pendState.x[0], theta: pendState.x[2] };
  };

  return (
    <>
      <div className="container">
        {/* Row 1 */}
        <div className="row">
          <div className="box">
            <PendCanvas onRequestNewState={pendStateHandler} />
          </div>
          <div className="box">{/* <ChartPlot getData={getData} /> */}</div>
        </div>

        {/* Row 2 */}
        <div className="row">
          <div className="box">
            <p>u value output</p>
            {/* <BasicTextOutput ref={BasicTextRef} /> */}
            {/* <PendStateText pendState={pendState} /> */}
          </div>
          <div className="box">
            <p>TestCanvas</p>
            <ChartCanvas onRequestNewState={pendStateHandler} />
            {/* <Canvas getDraw={getChartDraw} /> */}
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
