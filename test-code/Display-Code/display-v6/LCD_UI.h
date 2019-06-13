#ifndef LCD_UI_h
#define LCD_UI_h
#include "Arduino.h"
#include <LiquidCrystal.h>

class LCD_UI
{
  public:
    LCD_UI(char **optionsList, int N, int enterPin, int upPin, int downPin, LiquidCrystal &lcd);
    int update();
    int enter();
    void up();
    void down();
    void print();
    void reset();
  private:
    char **_optionsList;
    int _enterPin;
    int _upPin;
    int _downPin;
    int _i;
    int _j;
    int _k;
    int _N;
    LiquidCrystal &_lcd;
    // _States state;
};

#endif