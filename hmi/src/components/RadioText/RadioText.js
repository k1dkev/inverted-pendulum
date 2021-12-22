import React from "react";
import "./RadioText.css";

const RadioText = () => {
  return (
    <form>
      <div class="radio-group">
        <input className="radio-text" type="radio" id="option-one" name="selector" />
        <label className="radio-text-label" for="option-one">
          Auto
        </label>
        <input className="radio-text" type="radio" id="option-two" name="selector" />
        <label className="radio-text-label" for="option-two">
          Manual
        </label>
      </div>
    </form>
  );
};

export default RadioText;
