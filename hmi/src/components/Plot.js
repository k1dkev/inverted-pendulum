import React from "react";
import Plotly from "plotly.js";
import { useEffect } from "react";

const Plot = (props) => {
  const { getData } = props;

  useEffect(() => {
    Plotly.plot("plot", [
      {
        y: [getData()],
        type: "line",
      },
    ]);

    var cnt = 0;
    setInterval(function () {
      Plotly.extendTraces("plot", { y: [[getData()]] }, [0]);
      cnt++;
      if (cnt > 400) {
        Plotly.relayout("plot", {
          xaxis: {
            range: [cnt - 400, cnt],
          },
        });
      }
    }, 15);
    // return () => {
    //     cleanup
    // }
  }, [getData]);

  return <div id="plot"></div>;
};

export default Plot;
