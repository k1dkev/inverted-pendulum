#ifndef ton_h
#define ton_h
#include "Arduino.h"

class ton
{
  public:
    ton(unsigned long PT, unsigned long *currentTimePointer);
    void update();
    void reset();
    unsigned long _PT;
    unsigned long _ET;
    bool _Q;
    bool _RUN;
  private:
    unsigned long *_currentTimePointer;
    unsigned long _lastTime;
};

#endif