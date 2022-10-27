// import "./App.css";
import Canvas from "../Canvas/Canvas";
import Assembly from "../../utils/Assembly";
import { useEffect, useRef } from "react";
import pendulum from "../../utils/Pendulum";

const PendCanvas = (props) => {
  const { passDataToParent } = props;
  const uRef = useRef(0);
  const arrowRightPressedRef = useRef(false);
  const arrowLeftPressedRef = useRef(false);
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

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  var assembly = new Assembly(5);
  var prevTime = 0;
  var x = [0, 0, 0, 0];

  const getPendDraw = (ctx) => {
    return (t) => {
      assembly.draw(ctx, t);
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
      passDataToParent({ x: x, u: uRef.current });
    };
  };

  return <Canvas getDraw={getPendDraw} />;
};

export default PendCanvas;
