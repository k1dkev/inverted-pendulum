// Works with physical push buttons

#include "LCD_UI.h"
#include "Arduino.h"
#include <LiquidCrystal.h>
#include "digital_input.h"

int enterPin = 13;
int upPin = 10;
int downPin = 9;

unsigned long globalCurrentTime = 0;

enum States {MAIN_MENU, CALIBRATE, SWING_UP, BALANCE};
char *options[] = {"Swing up", "Balance", "Calibrate"};
States stateOptionArray[] = {SWING_UP, BALANCE, CALIBRATE};
States state = MAIN_MENU;
States lastState = CALIBRATE; // Make sure lastState != state as initial value
States nextState = MAIN_MENU;
const unsigned long debounceTime = 50000;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
digital_input enterPB(enterPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
digital_input upPB(upPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
digital_input downPB(downPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
LCD_UI ui(options, 3, &lcd);

States main_menu(void);
States calibrate(void);
States balance(void);
States swing_up(void);

void setup() {
    lcd.begin(16,2);
    pinMode(enterPin,INPUT_PULLUP);
    pinMode(upPin,INPUT_PULLUP);
    pinMode(downPin,INPUT_PULLUP);
}

void loop() {
    globalCurrentTime = micros();
    switch (state) {
        case MAIN_MENU: nextState = main_menu(); break;
        case CALIBRATE: nextState = calibrate(); break;
        case BALANCE:   nextState = balance();   break;
        case SWING_UP:  nextState = swing_up();  break;
        default: break;
    }
    lastState = state;
    state = nextState;
}

States main_menu() {
    if (lastState != state) {
        lcd.clear();
        ui.print();
    }
    enterPB.update();
    upPB.update();
    downPB.update();
    if (enterPB._risingEdge) return stateOptionArray[ui.getIndex()];
    if (downPB._risingEdge) ui.down();
    if (upPB._risingEdge) ui.up();
    return MAIN_MENU;
}

States balance() {
    if (lastState != state) {
        lcd.clear();
        lcd.print("BALANCE STATE");
    }
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;
	return BALANCE;
}

States calibrate() {
    if (lastState != state) {
        lcd.clear();
        lcd.print("CALIBRATE");
    }
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;
	return CALIBRATE;
}

States swing_up() {
    if (lastState != state) {
        lcd.clear();
        lcd.print("SWING_UP STATE");
    }
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;
	return SWING_UP;
}