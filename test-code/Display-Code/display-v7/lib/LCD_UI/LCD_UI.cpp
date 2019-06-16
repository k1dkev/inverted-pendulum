#include "Arduino.h"
#include "LCD_UI.h"
#include <LiquidCrystal.h>

LCD_UI::LCD_UI(char **optionsList, int N, LiquidCrystal *lcd)
{
  // Setting up default values of fields
  _optionsList = optionsList; // List of options
  _i = 0;                     // Option Index
  _j = 0;                     // Screen Index
  _N = N;                     // Number of Options
  _lcd = lcd;                 // Pointer to LCD
}

int LCD_UI::getIndex()
{
 return _i;
}

void LCD_UI::down()
{
  if (_i < _N-1) _i++;
  if (_i > (_j + 1)) _j += 2;
  if (_j > _N-1) _j = _N - 1;
  print();
}

void LCD_UI::up()
{
  if (_i > 0) _i--;
  if (_i < _j) _j -= 2;
  if (_j < 0) _j = 0;
  print();
}

void LCD_UI::print()
{

  _lcd->clear();
  _lcd->print(_i == _j ? "->" : "  ");
  _lcd->print(_optionsList[_j]);
  _lcd->setCursor(0, 1);
  if(_N%2 && _j == _N - 1) { // N is odd and _j is at end of array
    _lcd->setCursor(0, 1);
  } else { // N is even
    _lcd->print(_i != _j ? "->" : "  ");
    _lcd->print(_optionsList[_j+1]);
  }
}