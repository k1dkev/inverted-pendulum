import { useRef, useEffect } from "react";

const useCanvas = (draw) => {
  const canvasRef = useRef(null);

  // Use Effect will run on mount / every re-render or if the dependency array (2nd arg) changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    let animationFrameId;

    const render = (t) => {
      draw(context, t);
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
