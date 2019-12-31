#include <Arduino.h>

// char mystr[10]; //Initialized variable to store recieved data
// int incomingByte = 0;
// void setup() {
//   // Begin the Serial at 9600 Baud
//   Serial.begin(9600);
// }

// void loop() {
//   if (Serial.available() > 0) {
//     incomingByte = Serial.read();
//     if (incomingByte == 'H'){
//       digitalWrite(13, HIGH);
//     } else if (incomingByte == 'L') {
//       digitalWrite(13, LOW);
//     }
//     // say what you got:
//     Serial.print("I received: ");
//     Serial.println(incomingByte, DEC);
//   }
// }

char mystr[10]; //Initialized variable to store recieved data

int i;

void setup() {
  // Begin the Serial at 9600 Baud
  Serial.begin(9600);
}

void loop() {
  i = 0;
  while (Serial.available() > 0 && i < 10) {
    mystr[i] = Serial.read();
    i++;
  }
  mystr[i] = '\0';
  // Serial.readBytes(mystr,5); //Read the serial data and store in var
  Serial.println(mystr); //Print data on Serial Monitor
  delay(1000);
}