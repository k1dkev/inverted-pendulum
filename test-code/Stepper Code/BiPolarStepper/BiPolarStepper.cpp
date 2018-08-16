#include "Arduino.h"
#include "BiPolarStepper.h"

BiPolarStepper::BiPolarStepper(int enaPin, int dirPin, int pulPin, int stepMode)
{
  _enaPin = enaPin;
  _dirPin = dirPin;
  _pulPin = pulPin;
  _stepsPerRev = 200*stepMode;
  _dir = true;
  _stepTime = 1000000000;
  _w = 0;
  _k = 2000000.0*PI/_stepsPerRev;
  _lastTime = micros();
  _stepCount = 0;
  _desiredStep = 0;
  _done = true;
  _maxSpeed = 62.83; // 600 rpm
  pinMode(_enaPin, OUTPUT);
  pinMode(_dirPin, OUTPUT);
  pinMode(_pulPin, OUTPUT);
  digitalWrite(_enaPin, LOW); // LOW is enabled
  digitalWrite(_dirPin, _dir);
  digitalWrite(_pulPin, LOW);
}

void BiPolarStepper::setDirection(bool dir)
{
  _dir = dir;
  digitalWrite(_dirPin, _dir);
}

void BiPolarStepper::oneStep()
{
  unsigned long t = micros();
  if ((t - _lastTime) > _stepTime && !_done) {
    digitalWrite(_pulPin, HIGH);
    digitalWrite(_pulPin, LOW);
    _lastTime = t;
    _stepCount += _dir ? 1 : -1;
    if (_stepCount == _desiredStep) _done = true;
  }
}

void BiPolarStepper::setDesiredStep(long desiredStep)
{
  _desiredStep = desiredStep;
  if (_desiredStep > _stepCount) {
    setDirection(true);
    _done = false;
  } else if (_desiredStep < _stepCount) {
    setDirection(false);
    _done = false;
  } else {
    _done = true;
  }
}

void BiPolarStepper::setStepTime(unsigned long stepTime)
{
  if (stepTime > 1000000000) {
    stepTime = 1000000000;
  } else if (stepTime < _k/_maxSpeed) {
    stepTime = _k/_maxSpeed;
  } else {
    _stepTime = stepTime;
  }
  _w = _k/((float)_stepTime);
}

void BiPolarStepper::setW(float w)
{
  if (w > _maxSpeed) {
    _w = _maxSpeed;
  } else {
    _w = w;
  }
  if (_w < .0001) {
    _stepTime = 1000000000;
  } else {
    _stepTime = (unsigned long)_k/_w;
  }
}

bool BiPolarStepper::goToDesiredStep()
{
  if (_desiredStep != _stepCount ) {
    oneStep();
    return false;
  } else {
    return true;
  }
}

