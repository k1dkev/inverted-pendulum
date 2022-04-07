import { useRef, useEffect } from "react";

const useCanvas = (draw: any) => {
  const canvasRef = useRef(null);

  // Use Effect will run on mount / every re-render or if the dependency array (2nd arg) changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    let animationFrameId: any;

    const render = (t: any) => {
      // console.log(`Offset Width: ${canvas.offsetWidth}`);
      draw(canvas, t);
      animationFrameId = window.requestAnimationFrame(render);
    };
    render(0);

    // If useEffect returns a function, that function will be called on unmount of the component
    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [draw]);

  return canvasRef;
};

export default useCanvas;
