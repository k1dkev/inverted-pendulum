#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

char incomingByte = 0;
const byte numChars = 32;
char receivedChars[numChars];   // an array to store the received data
boolean newData = false;

void setup() {
    lcd.begin(16,2);
    Serial.begin(9600);
}

void loop() {
    recvWithEndMarker();
    if (newData) {
        lcd.clear();
        if (strcmp(receivedChars, "E") == 0){
            lcd.print("Enter");
        } else if(strcmp(receivedChars, "R") == 0) {
            lcd.print("Right Carrat");
        } else if(strcmp(receivedChars, "L") == 0) {
            lcd.print("Left Carrat");
        }
        newData = false;
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