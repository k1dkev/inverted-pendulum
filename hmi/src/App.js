import "./App.css";
import { useEffect, useRef, useState } from "react";
import PendChart from "./components/PendChart/PendChart";
import PendCanvas from "./components/PendCanvas/PendCanvas";
import PendStateText from "./components/PendStateText/PendStateText";
import PendControls from "./components/PendControls/PendControls";
import useKeys from "./hooks/useKeys";
import { integratePendulumDynamics } from "./utils/Pendulum";

function App() {
  const keys = useKeys();
  const [activeState, setActiveState] = useState({ x: [0, 0, 0, 0], u: 0 });
  const simState = useRef({ x: [0, 0, 0, 0], u: 0 });

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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveState(simState.current);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const pendCanvasHandler = (t, dt) => {
    simState.current = integratePendulumDynamics(simState.current.x, dt, keys);
    return { x: simState.current.x[0], theta: simState.current.x[2] };
  };

  const pendChartHandler = (t, deltaTime) => {
    return { x: 0, theta: 0 };
  };

  return (
    <div className="container">
      {/* Row 1 */}
      <div className="row">
        <div className="box">
          <p>box 1</p>
        </div>
        <div className="box">
          <PendCanvas onRequestNewState={pendCanvasHandler} />
        </div>
      </div>

      {/* Row 2 */}
      <div className="row">
        <div className="box">
          <PendStateText pendState={activeState} />
        </div>
        <div className="box">
          <PendChart onRequestNewState={pendChartHandler} />
        </div>
      </div>

      {/* Row 3 */}
      <div className="row">
        <div className="box">
          <PendControls />
        </div>
        <div className="box">
          <p>box 6</p>
        </div>
      </div>
    </div>
  );
}

export default App;
