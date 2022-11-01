const PendStateText = ({ pendState }) => {
  const { x, u } = pendState;
  return (
    <>
      <p>pend state</p>
      <p>u: {u}</p>
      <p>x[0]: {Math.round(x[0])}</p>
      <p>x[1]: {Math.round(x[1])}</p>
      <p>x[2]: {Math.round(x[2])}</p>
      <p>x[3]: {Math.round(x[3])}</p>
    </>
  );
};

export default PendStateText;
