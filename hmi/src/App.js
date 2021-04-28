import "./App.css";
import Canvas from "./components/Canvas";
import Assembly from "./utils/Assembly";

function App() {
  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  const draw = (ctx, frameCount) => {
    ctx.canvas.width = assembly.widthPx;
    ctx.canvas.height = assembly.heightPx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
    assembly.updateState({
      x: (frameCount % assembly.widthPx) - assembly.widthPx / 2,
      theta: frameCount / 100,
    });
  };

  return <Canvas draw={draw} />;
}

export default App;
