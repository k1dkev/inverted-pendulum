import React from "react";
import "./NiceButton.css";

const NiceButton = (props: any) => {
  var clsName;
  switch (props.color) {
    case "green":
      clsName = "NiceButtonGreen";
      break;
    case "red":
      clsName = "NiceButtonRed";
      break;
    default:
      clsName = "";
  }

  return <button className={clsName}>{props.name}</button>;
};

export default NiceButton;
