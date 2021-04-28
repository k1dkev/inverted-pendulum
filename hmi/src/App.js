import "./App.css";
import Canvas from "./components/Canvas";
import Assembly from "./utils/Assembly";
class Rectangle {
  #height = 0;
  #width;
  constructor(height, width) {
    this.#height = height;
    this.#width = width;
  }
  // Getter
  get area() {
    return this.calcArea();
  }
  // Method
  calcArea() {
    return this.#height * this.#width;
  }
}

function App() {
  const square = new Rectangle(5, 10);
  console.log(square.area); // 100
  var assembly = new Assembly(window.innerWidth, window.innerHeight);
  const draw = (ctx, frameCount) => {
    [ctx.canvas.width, ctx.canvas.height] = assembly.canvasSizeUpdate(window.innerWidth, window.innerHeight);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    assembly.draw(ctx);
    assembly.updateState({ x: (((2 * frameCount) / 2) % 500) - 250, theta: frameCount / 100 });
  };

  return <Canvas draw={draw} />;
}

export default App;
