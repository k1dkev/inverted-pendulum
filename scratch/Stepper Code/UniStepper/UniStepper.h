/*
  UniStepper.h - Library for flashing UniStepper code.
  Created by David A. Mellis, November 2, 2007.
  Released into the public domain.
*/
#ifndef UniStepper_h
#define UniStepper_h

#include "Arduino.h"

class UniStepper
{
  public:
    UniStepper(int motorPin1, int motorPin2, int motorPin3, int motorPin4);
    void setDirection(bool dir);
    void oneStep();
    void setDesiredStep(long desiredStep);
    void setRPM(float RPM);
    void goToDesiredStep();
    void oneEigthStep();
  private:
    int _motorPin1;
    int _motorPin2;
    int _motorPin3;
    int _motorPin4;
    int _stepsPerRev;
    unsigned long _stepTime;
    long _stepCount;
    long _desiredStep;
    unsigned long _lastTime;
    unsigned long _eigthStepTime;
    bool _dir;
    int _stepSeqPos;
};

#endif
