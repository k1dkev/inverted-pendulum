// Works with physical push buttons

// #include "LCD_UI.h"
#include <LiquidCrystal.h>

int enterPin = 13;
int upPin = 10;
int downPin = 9;

enum States {MAIN_MENU, CALIBRATE, SWING_UP, BALANCE};
//char *options[] = {"Swingup", "Balance", "Calibrate"};
// States stateOptionArray[] = {SWING_UP, BALANCE, CALIBRATE};
States state = MAIN_MENU;

LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
// LiquidCrystal *lcd_pointer = &lcd;
// LCD_UI ui(options,3,13,10,9,lcd);


void setup() {
    lcd.begin(16,2);
    lcd.print("Setup");
    delay(5000);
    pinMode(enterPin,INPUT_PULLUP);
    pinMode(upPin,INPUT_PULLUP);
    pinMode(downPin,INPUT_PULLUP);
}

void loop() {
    switch (state) {
        case MAIN_MENU: state = main_menu(); break;
        case CALIBRATE: state = calibrate(); break;
        case BALANCE:   state = balance();   break;
        case SWING_UP:  state = swing_up();  break;
        default: break;
    }
}

