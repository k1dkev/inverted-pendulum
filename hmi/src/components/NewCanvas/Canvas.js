import "./Canvas.css";
import React, { useEffect } from "react";

const Canvas = React.forwardRef((props, ref) => {
  const { onRequestFrame, ...rest } = props;

  useEffect(() => {
    let animationFrameId;

    const render = (t) => {
      onRequestFrame(t);
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
