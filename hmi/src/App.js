import "./App.css";
import Canvas from "./components/Canvas";
import ChartPlot from "./components/ChartPlot";
import Assembly from "./utils/Assembly";
import { useEffect, useRef } from "react";
import pendulum from "./utils/Pendulum";

function App() {
  const uRef = useRef(0);
  const arrowRightPressedRef = useRef(false);
  const arrowLeftPressedRef = useRef(false);

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
  };

  return (
    <>
      <div className="wrapper">
        <div className="box a">
          <Canvas draw={draw} />
        </div>
        <div className="box b">
          <ChartPlot getData={getData} />
        </div>
        {/* <div className="box c">
            <p>{uRef.current}</p>
          </div> */}
        {/* <div className="box d">D</div>
        <div className="box e">E</div>
        <div className="box f">F</div> */}
        {/* <Plot getData={getData} /> */}
      </div>
    </>
  );
}

export default App;
