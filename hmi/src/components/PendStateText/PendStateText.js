const PendStateText = ({ pendState }) => {
  const { x, u } = pendState;
  return (
    <>
      <p>pend state</p>
      <p>u: {u.toFixed(1)}</p>
      <p>x[0]: {x[0].toFixed(1)}</p>
      <p>x[1]: {x[1].toFixed(1)}</p>
      <p>x[2]: {x[2].toFixed(1)}</p>
      <p>x[3]: {x[3].toFixed(1)}</p>
    </>
  );
};

export default PendStateText;
