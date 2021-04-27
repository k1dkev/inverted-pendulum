import "./App.css";
import Canvas from "./components/Canvas";
import Assembly from "./utils/Assembly";

function App() {
  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  const draw = (ctx, frameCount) => {
    ctx.canvas.width = assembly.widthPx;
    ctx.canvas.height = assembly.heightPx;
    console.log(assembly.widthMM, assembly.heightMM);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
  };

  return <Canvas draw={draw} />;
}

export default App;
