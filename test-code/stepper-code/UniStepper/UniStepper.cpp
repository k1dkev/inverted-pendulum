#include "Arduino.h"
#include "UniStepper.h"

UniStepper::UniStepper(int motorPin1, int motorPin2, int motorPin3, int motorPin4)
{
  _stepsPerRev = 512;
  _motorPin1 = motorPin1;
  _motorPin2 = motorPin2;
  _motorPin3 = motorPin3;
  _motorPin4 = motorPin4;
  _dir = true;
  _stepCount = 0;
  _stepTime = 8*800;
  _eigthStepTime = _stepTime/8;
  _lastTime = micros();
  _desiredStep = 0;
  _stepSeqPos = 1;
  pinMode(_motorPin1, OUTPUT);
  pinMode(_motorPin2, OUTPUT);
  pinMode(_motorPin3, OUTPUT);
  pinMode(_motorPin4, OUTPUT);
  digitalWrite(_motorPin1, HIGH);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, LOW);
}

void UniStepper::setDirection(bool dir)
{
  _dir = dir;
}

void UniStepper::oneStep()
{
  digitalWrite(_motorPin1, HIGH);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, LOW);
  delayMicroseconds(_eigthStepTime);
  
  digitalWrite(_motorPin1, HIGH);
  digitalWrite(_motorPin2, HIGH);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, LOW);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, LOW);
  digitalWrite(_motorPin2, HIGH);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, LOW);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, LOW);
  digitalWrite(_motorPin2, HIGH);
  digitalWrite(_motorPin3, HIGH);
  digitalWrite(_motorPin4, LOW);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, LOW);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, HIGH);
  digitalWrite(_motorPin4, LOW);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, LOW);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, HIGH);
  digitalWrite(_motorPin4, HIGH);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, LOW);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, HIGH);
  delayMicroseconds(_eigthStepTime);

  digitalWrite(_motorPin1, HIGH);
  digitalWrite(_motorPin2, LOW);
  digitalWrite(_motorPin3, LOW);
  digitalWrite(_motorPin4, HIGH);
  delayMicroseconds(_eigthStepTime);
}

void UniStepper::setDesiredStep(long desiredStep)
{
  _desiredStep = desiredStep;
}

void UniStepper::setRPM(float RPM)
{
  _stepTime = 1000000*60/(_stepsPerRev*RPM);
  _eigthStepTime = _stepTime/8;
}

void UniStepper::goToDesiredStep()
{
  if (_desiredStep - _stepCount == 0) {
    return;
  } else {
    if (_desiredStep - _stepCount > 0) {
      _dir = true;
    } else {
      _dir = false;
    }
    if(micros() - _lastTime > _eigthStepTime) {
      switch (_stepSeqPos) {
      case 1: 
        digitalWrite(_motorPin1, HIGH);
        digitalWrite(_motorPin2, LOW);
        digitalWrite(_motorPin3, LOW);
        digitalWrite(_motorPin4, LOW);
        _lastTime = micros();
        break;
      case 2:   
        digitalWrite(_motorPin1, HIGH);
        digitalWrite(_motorPin2, HIGH);
        digitalWrite(_motorPin3, LOW);
        digitalWrite(_motorPin4, LOW);
        _lastTime = micros();
        break;
      case 3:   
        digitalWrite(_motorPin1, LOW);
        digitalWrite(_motorPin2, HIGH);
        digitalWrite(_motorPin3, LOW);
        digitalWrite(_motorPin4, LOW);
        _lastTime = micros();
        break;
      case 4:   
        digitalWrite(_motorPin1, LOW);
        digitalWrite(_motorPin2, HIGH);
        digitalWrite(_motorPin3, HIGH);
        digitalWrite(_motorPin4, LOW);
        _lastTime = micros();
        break;
      case 5:   
        digitalWrite(_motorPin1, LOW);
        digitalWrite(_motorPin2, LOW);
        digitalWrite(_motorPin3, HIGH);
        digitalWrite(_motorPin4, LOW);
        _lastTime = micros();
        break;
      case 6: 
        digitalWrite(_motorPin1, LOW);
        digitalWrite(_motorPin2, LOW);
        digitalWrite(_motorPin3, HIGH);
        digitalWrite(_motorPin4, HIGH);
        _lastTime = micros();
        break;
      case 7:
        digitalWrite(_motorPin1, LOW);
        digitalWrite(_motorPin2, LOW);
        digitalWrite(_motorPin3, LOW);
        digitalWrite(_motorPin4, HIGH);  
        _lastTime = micros();
        break;     
      case 8: 
        digitalWrite(_motorPin1, HIGH);
        digitalWrite(_motorPin2, LOW);
        digitalWrite(_motorPin3, LOW);
        digitalWrite(_motorPin4, HIGH);
        _lastTime = micros();
        break;             
      default: printf("Shouldn't Happen");
        break;  
      }
      if (_dir){
        if (_stepSeqPos == 8) {
          _stepCount++;
          _stepSeqPos = 1;
        } else {
          _stepSeqPos++;
        }
      } else {
        if (_stepSeqPos == 1) {
          _stepCount--;
          _stepSeqPos = 8;
        } else {
          _stepSeqPos--;
        }
      }
    }
  }
}

void UniStepper::oneEigthStep()
{
  if(micros() - _lastTime > _eigthStepTime) {
    switch (_stepSeqPos) {
    case 1: 
      digitalWrite(_motorPin1, HIGH);
      digitalWrite(_motorPin2, LOW);
      digitalWrite(_motorPin3, LOW);
      digitalWrite(_motorPin4, LOW);
      _lastTime = micros();
      break;
    case 2:   
      digitalWrite(_motorPin1, HIGH);
      digitalWrite(_motorPin2, HIGH);
      digitalWrite(_motorPin3, LOW);
      digitalWrite(_motorPin4, LOW);
      _lastTime = micros();
      break;
    case 3:   
      digitalWrite(_motorPin1, LOW);
      digitalWrite(_motorPin2, HIGH);
      digitalWrite(_motorPin3, LOW);
      digitalWrite(_motorPin4, LOW);
      _lastTime = micros();
      break;
    case 4:   
      digitalWrite(_motorPin1, LOW);
      digitalWrite(_motorPin2, HIGH);
      digitalWrite(_motorPin3, HIGH);
      digitalWrite(_motorPin4, LOW);
      _lastTime = micros();
      break;
    case 5:   
      digitalWrite(_motorPin1, LOW);
      digitalWrite(_motorPin2, LOW);
      digitalWrite(_motorPin3, HIGH);
      digitalWrite(_motorPin4, LOW);
      _lastTime = micros();
      break;
    case 6: 
      digitalWrite(_motorPin1, LOW);
      digitalWrite(_motorPin2, LOW);
      digitalWrite(_motorPin3, HIGH);
      digitalWrite(_motorPin4, HIGH);
      _lastTime = micros();
      break;
    case 7:
      digitalWrite(_motorPin1, LOW);
      digitalWrite(_motorPin2, LOW);
      digitalWrite(_motorPin3, LOW);
      digitalWrite(_motorPin4, HIGH);  
      _lastTime = micros();
      break;     
    case 8: 
      digitalWrite(_motorPin1, HIGH);
      digitalWrite(_motorPin2, LOW);
      digitalWrite(_motorPin3, LOW);
      digitalWrite(_motorPin4, HIGH);
      _lastTime = micros();
      break;             
    default: printf("Shouldn't Happen");
      break;  
    }
    if (_dir){
      if (_stepSeqPos == 8) {
        _stepCount++;
        _stepSeqPos = 1;
      } else {
        _stepSeqPos++;
      }
    } else {
      if (_stepSeqPos == 1) {
        _stepCount--;
        _stepSeqPos = 8;
      } else {
        _stepSeqPos--;
      }
    }
  }
}