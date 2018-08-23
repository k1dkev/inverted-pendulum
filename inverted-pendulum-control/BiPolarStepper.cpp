#include "Arduino.h"
#include "BiPolarStepper.h"

BiPolarStepper::BiPolarStepper(int enaPin, int dirPin, int pulPin, int stepMode)
{
  // Setting up default values of fields
  _stop = true;                   // Stepper is stopped by default
  _enaPin = enaPin;               // Enable Pin
  _dirPin = dirPin;               // Direction Pin
  _pulPin = pulPin;               // Pulse Pin (Driver executes step on falling edge)
  _stepsPerRev = 200*stepMode;    // 200 full steps per rev. stepMode = 2 if halfstepping.
  _stepTime = 1000000000;         // Time inbetween steps (Speed of stepper)
  _lastTime = micros();           // Time at when the last step was executed
  _stepCount = 0;                 // The step position of cart
  _dir = true;                    // Direction of stepper. High goes towards the motor.
  _k = 2000000.0*PI/_stepsPerRev; // Convertion factor from rad/s to steptime. w = k/stepTime.
  _b = 16.0/PI;                   // Converstion factor from rad/s to mm/s. v = b*w.
  _Lt = 190.0;                    // Half of allowable track length. Stepper can move to +/- Lt (mm)
  _w = 0;                         // Angular velocity of stepper motor (rad/s)
  _maxSpeed = 62.83;              // Max angular velocity. 600 rpm or about 320 mm/s
  _xMaxAccel = 10000;             // About 1g of linear acceleration (mm/s^2)

  // Setting digital pins to be outputs
  pinMode(_enaPin, OUTPUT);
  pinMode(_dirPin, OUTPUT);
  pinMode(_pulPin, OUTPUT);

  // Setting default values of pins
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
