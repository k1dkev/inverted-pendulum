#ifndef digital_input_h
#define digital_input_h
#include "Arduino.h"
#include "timers.h"

class digital_input
{
  public:
    digital_input(int pin, unsigned long onDebounce, unsigned long offDebounce, unsigned long *currentTimePointer, int mode);
    void update();
    bool _rawOn;
    bool _on;
    bool _risingEdge;
    bool _fallingEdge;
  private:
    ton *_tonTimer;
    tof *_tofTimer;
    int _pin;
    bool _lastState;
    bool _invert;
};

#endif