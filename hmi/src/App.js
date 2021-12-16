import "./App.css";
import Canvas from "./components/Canvas";
import ChartPlot from "./components/ChartPlot";
import BasicTextOutput from "./components/BasicTextOutput";
import Assembly from "./utils/Assembly";
import { useEffect, useRef } from "react";
import pendulum from "./utils/Pendulum";
import Toggle from "./components/Toggle";
import RadioText from "./components/RadioText";

function App() {
  const uRef = useRef(0);
  const arrowRightPressedRef = useRef(false);
  const arrowLeftPressedRef = useRef(false);
  const BasicTextRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      switch (event.key) {
        case "ArrowRight":
          arrowRightPressedRef.current = true;
          break;
        case "ArrowLeft":
          arrowLeftPressedRef.current = true;
          break;
        default:
        //do nothing
      }
    };

    const handleKeyUp = (event) => {
      switch (event.key) {
        case "ArrowRight":
          arrowRightPressedRef.current = false;
          break;
        case "ArrowLeft":
          arrowLeftPressedRef.current = false;
          break;
        default:
        //do nothing
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  var prevTime = 0;
  var x = [0, 0, 0, 0];
  function getData() {
    return x[0];
  }

  const draw = (ctx, t) => {
    [ctx.canvas.width, ctx.canvas.height] = assembly.canvasSizeUpdate(window.innerWidth - 50, window.innerHeight);
    //ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);

    let currentTime = Number(t / 1000);
    let deltaTime = currentTime - prevTime;
    const MAX_VEL = 400.0;
    const MAX_POS = 224.5;
    const ACCEL = 3000.0;
    if (arrowRightPressedRef.current && !arrowLeftPressedRef.current) {
      uRef.current = ACCEL;
    } else if (!arrowRightPressedRef.current && arrowLeftPressedRef.current) {
      uRef.current = -ACCEL;
    } else {
      uRef.current = 0.0;
    }
    if (x[1] > MAX_VEL) {
      x[1] = MAX_VEL;
    }
    if (x[1] < -MAX_VEL) {
      x[1] = -MAX_VEL;
    }
    if (x[0] > MAX_POS) {
      x[0] = MAX_POS;
      x[1] = 0.0;
    }
    if (x[0] < -MAX_POS) {
      x[0] = -MAX_POS;
      x[1] = 0.0;
    }
    if (x[1] > 0.999 * MAX_VEL || x[0] > 0.999 * MAX_POS) {
      uRef.current = uRef.current > 0.0 ? 0.0 : uRef.current;
    }
    if (x[1] < -0.999 * MAX_VEL || x[0] < -0.999 * MAX_POS) {
      uRef.current = uRef.current < 0.0 ? 0.0 : uRef.current;
    }

    x = deltaTime ? pendulum.integrate(x, uRef.current, pendulum.dynamics, deltaTime) : x;
    assembly.updateState({ x: x[0], theta: x[2] });
    prevTime = currentTime;
    BasicTextRef.current.updateValue(uRef.current);
  };

  return (
    <>
      <div className="box-row">
        <div className="box">
          <Canvas draw={draw} />
        </div>
        <div className="box">
          <ChartPlot getData={getData} />
        </div>
      </div>
      <div className="box-row">
        <div className="box box-short">
          <BasicTextOutput ref={BasicTextRef} />
        </div>
        <div className="box box-short">
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
        <div className="box box-short">E</div>
        <div className="box box-short">F</div>
      </div>
    </>
  );
}

export default App;
