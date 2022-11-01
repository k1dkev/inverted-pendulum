import NiceButton from "../NiceButton/NiceButton";
import RadioText from "../RadioText/RadioText";

function PendControls() {
  return (
    <>
      <div className="row">
        <div className="column">
          <p className="p-text">Simulation</p>
        </div>
        <div className="column">
          <RadioText label1="On" label2="Off" />
        </div>
      </div>
      <div className="row">
        <div className="column">
          <p style={{ margin: 0, marginRight: 10 }}>Mode</p>
        </div>
        <div className="column">
          <RadioText className="right" label1="Auto" label2="Manual" />
        </div>
      </div>
      <div className="row">
        <div className="column">
          <p style={{ margin: 0, marginRight: 10 }}>Run</p>
        </div>
        <div className="column">
          <div className="row">
            <div className="container">
              <NiceButton name="Start" color="green" />
            </div>
            <div className="container">
              <NiceButton name="Stop" color="red" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PendControls;
