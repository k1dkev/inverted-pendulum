import useCanvas from "./useCanvas";
import "./Canvas.css";
import { useEffect } from "react";

const Canvas = ({ canvasRef }) => {
  return <canvas className="canvas-react" ref={canvasRef} />;
};

export default Canvas;
