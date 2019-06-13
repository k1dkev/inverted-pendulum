// Works with keypresstest-4.py

#include <LiquidCrystal.h>
#include "LCD_UI.h"
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
char incomingByte = 0;
const byte numChars = 32;
char receivedChars[numChars];   // an array to store the received data
boolean newData = false;

char *options[] = {"Swingup", "Balance", "Calibrate"};

LCD_UI ui(options,3,1,2,3);

void setup() {
    lcd.begin(16,2);
    Serial.begin(9600);
}

void loop() {
    recvWithEndMarker();
    if (newData) {
        lcd.clear();
        if (strcmp(receivedChars, "E") == 0){
            ui.enter();
        } else if(strcmp(receivedChars, "R") == 0) {
            ui.down();
        } else if(strcmp(receivedChars, "L") == 0) {
            ui.up();
        }
        newData = false;
    }
    //ui.update();
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

