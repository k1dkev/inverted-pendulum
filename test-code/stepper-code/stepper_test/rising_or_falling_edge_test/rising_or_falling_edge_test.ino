int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
int ledPin = 13;
bool lastDir = HIGH;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  pinMode(ledPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
}

void loop() {
   for (int i = 0; i < 5*stepsPerRev; i++){
      //digitalWrite(ledPin, LOW);
      digitalWrite(pulPin, LOW);
      //delayMicroseconds(1);
      //digitalWrite(ledPin, HIGH);
      digitalWrite(pulPin, HIGH);
      delay(500);
   }
   digitalWrite(dirPin, !lastDir); // Switches direction
   lastDir = !lastDir;
}

// The answer is falling edge!
