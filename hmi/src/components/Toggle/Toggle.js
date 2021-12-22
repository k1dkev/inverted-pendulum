import React from "react";
import "./Toggle.css";

const Toggle = () => {
  return (
    <label className="switch">
      <input type="checkbox" />
      <span className="slider round"></span>
    </label>
  );
};

export default Toggle;
