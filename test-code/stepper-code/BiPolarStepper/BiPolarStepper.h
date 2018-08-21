#ifndef BiPolarStepper_h
#define BiPolarStepper_h
#include "Arduino.h"

class BiPolarStepper
{
  public:
    BiPolarStepper(int enaPin, int dirPin, int pulPin, int stepMode);
    void setDirection(bool dir);
    void run();
    void oneStep();
    void setDesiredStep(long desiredStep);
    void setStepTime(unsigned long stepTime);
    void setW(float w);
    bool goToDesiredStep();
    int sgn(float val);
    void setV(float v);
    void accel(float a, float dt);
    float getX();
    float getV();
    bool _stop;
  private:
    int _enaPin;
    int _dirPin;
    int _pulPin;
    int _stepsPerRev;
    unsigned long _stepTime;
    long _stepCount;
    long _desiredStep;
    float _maxSpeed;
    unsigned long _lastTime;
    bool _dir;
    float _k;
    float _w;
    float _b;
    float _Lt;
    float _xMaxAccel;
};

#endif
