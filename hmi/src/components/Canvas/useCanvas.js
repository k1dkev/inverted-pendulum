import { useRef, useEffect } from "react";

const useCanvas = (draw) => {
  const canvasRef = useRef(null);

  // Use Effect will run on mount / every re-render or if the dependency array (2nd arg) changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId;

    const render = (t) => {
      draw(canvas.getContext("2d"), t);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();

    // If useEffect returns a function, that function will be called on unmount of the component
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [draw]);

  return canvasRef;
};

export default useCanvas;
