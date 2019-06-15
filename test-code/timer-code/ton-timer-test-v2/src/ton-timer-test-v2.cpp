#include "timers.h"
#include "digital_input.h"
#include "Arduino.h"

unsigned long globalCurrentTime = 0;
bool toggleBit = false;
digital_input enterPB(13, 1000000, 50000, &globalCurrentTime, INPUT_PULLUP);

void setup() {
    Serial.begin(9600);
}

void loop() {
    globalCurrentTime = micros();
    enterPB.update();
    if (enterPB._risingEdge) toggleBit = !toggleBit;
    Serial.print("on: ");
    Serial.print(enterPB._on);
    Serial.print(", rawOn: ");
    Serial.print(enterPB._rawOn);
    Serial.print(", togglebit: ");
    Serial.println(toggleBit);
}