#include "Arduino.h"
#include "digital_input.h"

digital_input::digital_input(int pin, unsigned long onDebounce, unsigned long offDebounce, unsigned long *currentTimePointer, int mode)
{
    pinMode(_pin, mode);
    _rawOn = false;
    _on = false;
    _risingEdge = false;
    _fallingEdge = false;
    _lastState = false;
    _pin = pin;
    _invert = (mode == INPUT_PULLUP);
    _tonTimer = new ton(onDebounce, currentTimePointer);
    _tofTimer = new tof(offDebounce, currentTimePointer);
}

void digital_input::update()
{
    _rawOn = digitalRead(_pin);
    if (_invert) _rawOn = !_rawOn;
    _tonTimer->update(_rawOn);
    _tofTimer->update(_rawOn);
    if (_tonTimer->_Q) _on = true;
    if (!_tofTimer->_Q) _on = false;
    _risingEdge = (_on && !_lastState);
    _fallingEdge = (!_on && _lastState);
    _lastState = _on;
}