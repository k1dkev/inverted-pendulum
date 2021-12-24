import React from "react";
import useCanvas from "../../hooks/useCanvas";
import "./Canvas.css";

const Canvas = (props) => {
  const { draw, ...rest } = props;
  const canvasRef = useCanvas(draw);
  return <canvas className="canvas-react" ref={canvasRef} {...rest} />;
};

export default Canvas;
