#include <Arduino.h>

char mystr[6] = "Hello"; //String data

void setup() {
  Serial.begin(9600);
}

void loop() {
  Serial.write(mystr,6); //Write the serial data
  delay(1000);
}

// void loop() {
//   Serial.print('H');
//   delay(1000);
//   Serial.print('L');
//   delay(1000);
// }