#ifndef LCD_UI_h
#define LCD_UI_h
#include "Arduino.h"
#include <LiquidCrystal.h>

class LCD_UI
{
  public:
    LCD_UI(char **optionsList, int N, LiquidCrystal *lcd);
    int getIndex();
    void up();
    void down();
    void print();
  private:
    char **_optionsList;
    int _i;
    int _j;
    int _n;
    LiquidCrystal *_lcd;
};

#endif