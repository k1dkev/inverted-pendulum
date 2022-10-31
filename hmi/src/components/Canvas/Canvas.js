import useCanvas from "./useCanvas";
import "./Canvas.css";
import React from "react";

const Canvas = React.memo((props) => {
  const { getDraw, ...rest } = props;
  const canvasRef = useCanvas(getDraw);
  return <canvas className="canvas-react" ref={canvasRef} {...rest} />;
});

export default Canvas;
