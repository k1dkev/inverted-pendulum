// import "./App.css";
import Canvas from "../NewCanvas/Canvas";
import Assembly from "../../utils/Assembly";
import { useEffect, useRef } from "react";

const PendCanvas = (props) => {
  const { onRequestNewState } = props;

  const canvasRef = useRef(null);
  const assemblyRef = useRef(null);
  const stateRef = useRef({ x: 0, theta: 0 });

  useEffect(() => {
    assemblyRef.current = new Assembly(5);
  }, []);

  const canvasHandler = (t) => {
    const ctx = canvasRef.current.getContext("2d");
    stateRef.current = onRequestNewState(t);
    assemblyRef.current.updateState(stateRef.current);
    assemblyRef.current.draw(ctx, t);
  };

  return <Canvas ref={canvasRef} onRequestFrame={canvasHandler} />;
};

export default PendCanvas;
