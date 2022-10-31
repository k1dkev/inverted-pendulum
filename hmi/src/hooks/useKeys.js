import { useEffect, useState } from "react";

const KEY = {
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  A: "a",
  D: "d",
  W: "w",
  S: "s",
  SPACE: "Space",
};

const useKeys = () => {
  const [keys, setKeys] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
    space: false,
  });

  useEffect(() => {
    const handleKeys = (value, e) => {
      if (e.key === KEY.LEFT || e.key === KEY.A)
        setKeys((prev) => {
          return { ...prev, left: value };
        });
      if (e.key === KEY.RIGHT || e.key === KEY.D)
        setKeys((prev) => {
          return { ...prev, right: value };
        });
      if (e.key === KEY.UP || e.key === KEY.W)
        setKeys((prev) => {
          return { ...prev, up: value };
        });
      if (e.key === KEY.DOWN || e.key === KEY.S)
        setKeys((prev) => {
          return { ...prev, up: value };
        });
      if (e.key === KEY.SPACE)
        setKeys((prev) => {
          return { ...prev, space: value };
        });
    };
    window.addEventListener("keyup", (e) => handleKeys(false, e));
    window.addEventListener("keydown", (e) => handleKeys(true, e));
  }, []);

  return keys;
};

export default useKeys;
