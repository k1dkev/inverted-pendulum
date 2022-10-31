import { useRef, useEffect } from "react";

const useCanvas = (getDraw) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const draw = getDraw(ctx);
    let animationFrameId;

    const render = (t) => {
      draw(t);
      animationFrameId = window.requestAnimationFrame(render);
    };
    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [getDraw]);

  return canvasRef;
};

export default useCanvas;
