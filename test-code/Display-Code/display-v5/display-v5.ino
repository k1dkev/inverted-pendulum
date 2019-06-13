// Works with keypresstest-4.py

#include "LCD_UI.h"
const byte numChars = 32;
char receivedChars[numChars];   // an array to store the received data
boolean newData = false;

enum States {MAIN_MENU, CALIBRATE, SWING_UP, BALANCE};
char *options[] = {"Swingup", "Balance", "Calibrate"};
States stateOptionArray[] = {SWING_UP, BALANCE, CALIBRATE};
States state = MAIN_MENU;
LCD_UI ui(options,3,1,2,3);

void setup() {
    Serial.begin(9600);
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

void recvWithEndMarker() {
    static byte ndx = 0;
    char endMarker = '\n';
    char rc;
    
    while (Serial.available() > 0 && newData == false) {
        rc = Serial.read();
        if (rc != endMarker) {
            receivedChars[ndx] = rc;
            ndx++;
            if (ndx >= numChars) {
                ndx = numChars - 1;
            }
        }
        else {
            receivedChars[ndx] = '\0'; // terminate the string
            ndx = 0;
            newData = true;
        }
    }
}