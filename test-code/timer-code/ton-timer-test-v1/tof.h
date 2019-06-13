#ifndef tof_h
#define tof_h
#include "Arduino.h"

class tof
{
  public:
    tof(unsigned long PT, unsigned long *currentTimePointer);
    void update();
    void reset();
    unsigned long _PT;
    unsigned long _RT;
    bool _Q;
    bool _RUN;
  private:
    unsigned long *_currentTimePointer;
    unsigned long _lastTime;
};

#endif