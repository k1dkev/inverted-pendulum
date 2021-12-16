import React from "react";
import "../Styles/RadioText.css";

const RadioText = () => {
  return (
    <form>
      <div class="radio-group">
        <input type="radio" id="option-one" name="selector" />
        <label className="radio-text-label" for="option-one">
          Auto
        </label>
        <input type="radio" id="option-two" name="selector" />
        <label className="radio-text-label" for="option-two">
          Manual
        </label>
      </div>
    </form>
  );
};

export default RadioText;
