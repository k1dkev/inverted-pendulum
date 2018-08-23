#include "Arduino.h"
#include "P3Encoder.h"

P3Encoder::P3Encoder(int sensorPin)
{
  // Setting up default values of fields
  _theta = 0.0;                   // Angle of pendulum
  _thetadot = 0.0;                // Angular velocity of pendulum
  _sensorPin = sensorPin;         // Sensor pin
  _Vup = 1472.60;                 // Average raw reading in the UPRIGHT position (12-bit)
  _Vd = 3452.86;                  // Average raw reading in the DOWNWARD position (12-bit)
  _c = PI/(_Vd - _Vup);           // Convertion Factor
  _lastTheta = PI;                // Last value of theta (for calc angular vel)
  _lastTimeOfUpdate = micros();   // Last time an update occured in us
  _dt = 1.0;                        // Time inbetween measurements in s

  // Setting analog to be an input
  pinMode(_sensorPin, INPUT);

  // Setting to 12 bit resolution
  analogReadResolution(12);
}

int P3Encoder::readRaw()
{
    return analogRead(_sensorPin);
}

void P3Encoder::update()
{
    int sensorReading = readRaw();

    // Converts sensor reading into radians
    float thetaBar = _c*((float)sensorReading - _Vup);
    if (thetaBar >= PI) {
        _theta = thetaBar - 2*PI;
    } else if ( thetaBar < -PI ) {
        _theta = thetaBar + 2*PI;
    } else {
        _theta = thetaBar;
    }

    // Getting the currentTime and calculating _dt
    unsigned long currentTime = micros();
    _dt = ((float)currentTime - (float)_lastTimeOfUpdate)/1000000.0;
    _lastTimeOfUpdate = currentTime;

    // Caculating angular velocity and accounting for discontinuity at PI
    if (sgn(_theta)*sgn(_lastTheta) < 0 && abs(_theta) > PI/2.0) {
      _thetadot = (_theta + _lastTheta)/_dt;
    } else {
      _thetadot = (_theta - _lastTheta)/_dt;
    }
    _lastTheta = _theta;
}

void P3Encoder::setVup(float Vup)
{
    _Vup = Vup;
    _c = PI/(_Vd - _Vup);
}

void P3Encoder::setVd(float Vd)
{
    _Vd = Vd;
    _c = PI/(_Vd - _Vup);
}

int P3Encoder::sgn(float val) {
 if (val < 0) return -1;
 if (val==0) return 0;
 return 1;
}
