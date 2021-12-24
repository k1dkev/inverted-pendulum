import React from "react";
import "./RadioText.css";
import { useState } from "react";
import _uniqueId from 'lodash/uniqueId';


const RadioText = (props) => {
  const [id1] = useState(_uniqueId('option1-'));
  const [id2] = useState(_uniqueId('option2-'));

  return (
    <form>
      <div className="radio-group">
        <input className="radio-text" type="radio" id={id1} name="selector" />
        <label className="radio-text-label" htmlFor={id1}>
          {props.label1}
        </label>
        <input className="radio-text" type="radio" id={id2} name="selector" />
        <label className="radio-text-label" htmlFor={id2}>
        {props.label2}
        </label>
      </div>
    </form>
  );
};

export default RadioText;
