import React from "react";
import useCanvas from "./useCanvas";
import "./Canvas.css";

const Canvas = (props) => {
  const { getDraw, ...rest } = props;
  const canvasRef = useCanvas(getDraw);
  return <canvas className="canvas-react" ref={canvasRef} {...rest} />;
};

export default Canvas;
