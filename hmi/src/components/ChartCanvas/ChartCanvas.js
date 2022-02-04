// import "./App.css";
import Canvas from "../Canvas/Canvas";

const ChartCanvas = (props) => {
  const W = 3000;
  const H = 2000;
  const numOfPoints = 1000;
  var shift = 0;

  const draw = (ctx, t) => {
    console.log(t);
    ctx.canvas.width = W;
    ctx.canvas.height = H;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    for (let i = 0; i <= numOfPoints; i++) {
      let x = (i * W) / numOfPoints;
      let y = (H / 4) * Math.sin(x / 100 + shift) + H / 2;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 10;
    ctx.stroke();
    shift += 0.1;
  };

  return <Canvas draw={draw} />;
};

export default ChartCanvas;

/*
params:
Num of data points
time length to save over
Num of axes

inputs
getData -> will return an array of (name,value) pairs
frequency -> How often the data should be pulled
time length -> Length of time to save data points for

outputs
names -> list of names
toggleCallback(name) -> will toggle the display of the 

edge cases
name stops pulling

potential things to plot u, x, v, /theta, /theta_dot

*/
