import "./Canvas.css";
import React, { useEffect, useRef } from "react";

const Canvas = React.forwardRef((props, ref) => {
  const { onRequestFrame, ...rest } = props;

  const prevTimeRef = useRef(null);
  const skipNextFrameRef = useRef(false);

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") skipNextFrameRef.current = true;
  };

  useEffect(() => {
    window.addEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    let animationFrameId;

    const render = (t) => {
      const currentTime = Number(t / 1000);
      if (!prevTimeRef.current) prevTimeRef.current = currentTime;
      if (skipNextFrameRef.current) {
        skipNextFrameRef.current = false;
        prevTimeRef.current = currentTime;
      }
      const deltaTime = currentTime - prevTimeRef.current;
      prevTimeRef.current = currentTime;
      onRequestFrame(t, deltaTime);
      animationFrameId = window.requestAnimationFrame(render);
    };
    animationFrameId = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [onRequestFrame]);

  return <canvas className="canvas-react" ref={ref} {...rest} />;
});

export default Canvas;
