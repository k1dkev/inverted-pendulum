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
  _k = 2000000.0*PI/_stepsPerRev; // Convertion factor from rad/s to steptime
  _lastTime = micros();
  _stepCount = 0;
  _desiredStep = 0;
  _stop = true;
  _maxSpeed = 62.83; // 600 rpm
  _b = 16.0/PI; // Converstion factor from rad/s to mm/s
  _Lt = 190.0;
  _xMaxAccel = 500; //  .05 g acceleration
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

void BiPolarStepper::run()
{
  unsigned long t = micros();
  if (abs(getX()) >= _Lt) _stop = true;
  if ((t - _lastTime) > _stepTime && !_stop) {
    digitalWrite(_pulPin, HIGH);
    digitalWrite(_pulPin, LOW);
    _lastTime = t;
    _stepCount += _dir ? 1 : -1;
    if (_stepCount == _desiredStep) _stop = true;
  }
}

void BiPolarStepper::oneStep()
{
  unsigned long t = micros();
  if ((t - _lastTime) > _stepTime && !_stop) {
    digitalWrite(_pulPin, HIGH);
    digitalWrite(_pulPin, LOW);
    _lastTime = t;
    _stepCount += _dir ? 1 : -1;
    if (_stepCount == _desiredStep) _stop = true;
  }
}

void BiPolarStepper::setDesiredStep(long desiredStep)
{
  _desiredStep = desiredStep;
  if (_desiredStep > _stepCount) {
    setDirection(true);
    _stop = false;
  } else if (_desiredStep < _stepCount) {
    setDirection(false);
    _stop = false;
  } else {
    _stop = true;
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
  if (abs(w) > _maxSpeed) {
    _w = _maxSpeed*sgn(w);
  } else {
    _w = w;
  }
  if (abs(_w) < .0001) {
    _stepTime = 1000000000;
  } else {
    _stepTime = (unsigned long)_k/abs(_w);
  }
  if (_w >= 0){
    setDirection(true);
  } else {
    setDirection(false);
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

int BiPolarStepper::sgn(float val)
{
 if (val < 0) return -1;
 if (val==0) return 0;
 return 1;
}

void BiPolarStepper::setV(float v)
{
  setW(v/_b);
}

void BiPolarStepper::accel(float a, float dt)
{
  if (abs(a) > _xMaxAccel) a = _xMaxAccel*sgn(a);
  setW(_w + a*dt/_b);
}

float BiPolarStepper::getX()
{
  return (float)_stepCount/12.5;
}

float BiPolarStepper::getV()
{
  return _b*_w;
}

















