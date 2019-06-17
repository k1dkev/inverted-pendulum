#ifndef P3Encoder_h
#define P3Encoder_h
#include "Arduino.h"

class P3Encoder
{
  public:
    P3Encoder(int sensorPin);
    int readRaw();
    void update();
    void setVup(float Vup);
    void setVd(float Vd);
    int sgn(float val);
    float _theta;
    float _thetadot;
    float _dt;
  private:
    int _sensorPin;
    float _Vup;
    float _Vd;
    float _c;
    float _lastTheta;
    unsigned long _lastTimeOfUpdate;
    float _wk;
    float _wkm1;
    float _wkm2;
    float _wkm3;
    float _wkm4;
};

#endif