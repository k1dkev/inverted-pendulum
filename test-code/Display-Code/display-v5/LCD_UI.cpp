#include "Arduino.h"
#include "LCD_UI.h"

LCD_UI::LCD_UI(char **optionsList, int N, int enterPin, int upPin, int downPin)
{
  // Setting up default values of fields
  _optionsList = optionsList; // List of options
  _enterPin = enterPin;       // Enter Pin
  _upPin = upPin;             // Up Pin 
  _downPin = downPin;         // Down Pin
  _i = 0;                     // Option Index
  _j = 0;                     // Screen Index
  _N = N;                     // Number of Options
  _k = _N;                    // Option selected (Initialized to N which is not a valid index of optionsList)           

  // Setting digital pins to be outputs
  pinMode(_enterPin, INPUT);
  pinMode(_upPin, INPUT);
  pinMode(_downPin, INPUT);
}

int LCD_UI::update()
{
  // if (_k != _N) _k = _N; resets _k to _N
  if (digitalRead(_enterPin)) {
    enter();
  } else if (digitalRead(_upPin)) {
    up();
  } else if (digitalRead(_downPin)) {
    down();
  }
  return _k;
}

int LCD_UI::enter()
{
 _k = _i;
 Serial.print("Enter pressed and option index is: ");
 Serial.println(_k);
 return _k;
}

void LCD_UI::down()
{
  if (_i < _N-1) {
    _i++;
  }
  if (_i > (_j + 1)) {
    _j = _j + 2;
  }
  if (_j > _N-1) {
    _j = _N-1;
  }
  print();
}

void LCD_UI::up()
{
  if (_i > 0) {
    _i--;
  }
  if (_i < _j) {
    _j = _j - 2;
  }
  if (_j < 0) {
    _j = 0;
  }
  print();
}

void LCD_UI::print()
{
  Serial.print("------------------------------- N: ");
  Serial.println(_N);
  Serial.print(_i == _j ? "->" : "  ");
  Serial.println(_optionsList[_j]);
  if(_N%2 && _j == _N - 1) { // N is odd and _j is at end of array
    Serial.println("");
  } else { // N is even
    Serial.print(_i != _j ? "->" : "  ");
    Serial.println(_optionsList[_j+1]);
  }
}

void LCD_UI::reset()
{
  _k = _N;
}