int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
bool lastDir = HIGH;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
}

void loop() {
   for (int i = 0; i < stepsPerRev; i++){
      digitalWrite(pulPin, LOW);
      delay(2);
      digitalWrite(pulPin, HIGH);
      delay(2);
   }
   digitalWrite(dirPin, !lastDir); // Switches direction
   lastDir = !lastDir;
}
