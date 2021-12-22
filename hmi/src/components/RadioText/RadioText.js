import React from "react";
import "./RadioText.css";

const RadioText = () => {
  return (
    <form>
      <div className="radio-group">
        <input className="radio-text" type="radio" id="option-one" name="selector" />
        <label className="radio-text-label" htmlFor="option-one">
          Auto
        </label>
        <input className="radio-text" type="radio" id="option-two" name="selector" />
        <label className="radio-text-label" htmlFor="option-two">
          Manual
        </label>
      </div>
    </form>
  );
};

export default RadioText;
