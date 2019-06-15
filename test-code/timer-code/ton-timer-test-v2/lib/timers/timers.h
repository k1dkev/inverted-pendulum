#ifndef timers_h
#define timers_h
#include "Arduino.h"

class ton
{
  public:
    ton(unsigned long PT, unsigned long *currentTimePointer);
    void update(bool RUN);
    void reset();
    unsigned long _PT;
    unsigned long _ET;
    bool _Q;
  private:
    unsigned long *_currentTimePointer;
    unsigned long _lastTime;
};

class tof
{
  public:
    tof(unsigned long PT, unsigned long *currentTimePointer);
    void update(bool RUN);
    void reset();
    unsigned long _PT;
    unsigned long _RT;
    bool _Q;
  private:
    unsigned long *_currentTimePointer;
    unsigned long _lastTime;
};

#endif