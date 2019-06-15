// Works with physical push buttons

// #include "LCD_UI.h"
#include "Arduino.h"
#include <LiquidCrystal.h>
#include "digital_input.h"

int enterPin = 13;
int upPin = 10;
int downPin = 9;

unsigned long globalCurrentTime = 0;

enum States {MAIN_MENU, CALIBRATE, SWING_UP, BALANCE};
//char *options[] = {"Swingup", "Balance", "Calibrate"};
// States stateOptionArray[] = {SWING_UP, BALANCE, CALIBRATE};
States state = MAIN_MENU;
const unsigned long debounceTime = 50000;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
digital_input enterPB(enterPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
digital_input upPB(upPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
//digital_input downPB(downPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
digital_input* downPB;
// LiquidCrystal *lcd_pointer = &lcd;
// LCD_UI ui(options,3,13,10,9,lcd);

States main_menu(void);
States calibrate(void);
States balance(void);
States swing_up(void);

void setup() {
    lcd.begin(16,2);
    downPB = new digital_input(downPin, debounceTime, debounceTime, &globalCurrentTime, INPUT_PULLUP);
    //lcd.print("Setup");
    // pinMode(enterPin,INPUT_PULLUP);
    pinMode(upPin,INPUT_PULLUP);
    //pinMode(downPin,INPUT_PULLUP);
}

void loop() {
    globalCurrentTime = micros();
    switch (state) {
        case MAIN_MENU: state = main_menu(); break;
        case CALIBRATE: state = calibrate(); break;
        case BALANCE:   state = balance();   break;
        case SWING_UP:  state = swing_up();  break;
        default: break;
    }
}

States main_menu() {
    enterPB.update();
    upPB.update();
    downPB->update();
    if (enterPB._risingEdge){
    	lcd.clear();
    	lcd.print("Enter");
    }
    if (downPB->_risingEdge){
    	lcd.clear();
    	lcd.print("Down");
    }
    if (upPB._risingEdge){
    	lcd.clear();
    	lcd.print("Up");
    }
    return MAIN_MENU;
}

States balance() {
	Serial.println("BALANCE STATE");
	return MAIN_MENU;
}

States calibrate() {
	lcd.clear();
	lcd.print("CALIBRATE");
	return MAIN_MENU;
}

States swing_up() {
	Serial.println("SWING_UP STATE");
	return MAIN_MENU;
}