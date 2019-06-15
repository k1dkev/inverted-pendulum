#ifndef ton_h
#define ton_h
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

#endif