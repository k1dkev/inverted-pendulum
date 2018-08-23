#ifndef BiPolarStepper_h
#define BiPolarStepper_h
#include "Arduino.h"

class BiPolarStepper
{
  public:
    BiPolarStepper(int enaPin, int dirPin, int pulPin, int stepMode);
    void setDirection(bool dir);
    void run();
    void setStepTime(unsigned long stepTime);
    void setW(float w);
    int sgn(float val);
    void setV(float v);
    void accel(float a, float dt);
    void stop();
    void unStop();
    float getX();
    float getV();
  private:
    bool _stop;
    int _enaPin;
    int _dirPin;
    int _pulPin;
    int _stepsPerRev;
    unsigned long _stepTime;
    unsigned long _lastTime;
    long _stepCount;
    bool _dir;
    float _k;
    float _b;
    float _Lt;
    float _w;
    float _maxSpeed;
    float _xMaxAccel;
};

#endif