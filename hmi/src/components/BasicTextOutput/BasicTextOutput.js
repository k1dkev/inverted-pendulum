import { React, useState, forwardRef, useImperativeHandle } from "react";

const BasicTextOutput = forwardRef((props, ref) => {
  const [value, setValue] = useState(0);
  useImperativeHandle(ref, () => ({
    updateValue(inputValue) {
      setValue(inputValue);
    },
  }));
  return <p>{value}</p>;
});

export default BasicTextOutput;
