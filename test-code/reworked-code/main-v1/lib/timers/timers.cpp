#include "timers.h"

//#################################### ton begin ####################################
ton::ton(unsigned long PT, unsigned long *currentTimePointer)
{
    // Setting up default values of fields
    _PT = PT;                                   // Preset time (In ms for now)
    _ET = 0;                                    // Elapsed time
    _Q  = false;                                // Done bit
    _currentTimePointer = currentTimePointer;   // Pointer to globabl current time
    _lastTime = *_currentTimePointer;           // Last time when update occured
}

void ton::update(bool RUN)
{
    if (RUN) {
        _ET += *_currentTimePointer - _lastTime;
    } else {
        _ET = 0;
    }
    _lastTime = *_currentTimePointer;
    _Q = (_ET >= _PT);
}

void ton::reset()
{
    _lastTime = *_currentTimePointer;
    _ET = 0;
}
//-----------------------------------  ton end  ------------------------------------
//################################### tof begin ####################################
tof::tof(unsigned long PT, unsigned long *currentTimePointer)
{
    // Setting up default values of fields
    _PT = PT;                                   // Preset time (In ms for now)
    _RT = 0;                                   // Remaining time
    _Q  = false;                                // Done bit
    _currentTimePointer = currentTimePointer;   // Pointer to globabl current time
    _lastTime = *_currentTimePointer;           // Last time when update occured
}

void tof::update(bool RUN)
{
    if (RUN) {
        _RT = _PT;
    } else {
        unsigned long DT = *_currentTimePointer - _lastTime;
        _RT = _RT > DT ? _RT - DT : 0;
    }
    _lastTime = *_currentTimePointer;
    _Q = (_RT != 0);
}

void tof::reset()
{
    _lastTime = *_currentTimePointer;
    _RT = _PT;
}
//----------------------------------- tof end -----------------------------------