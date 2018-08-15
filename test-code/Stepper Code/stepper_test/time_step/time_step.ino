int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
bool lastDir = HIGH;
long lastTime = 0;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
  lastTime = micros();
}

void loop() {
  if ( (micros() - lastTime) > 1000 ) {
    digitalWrite(pulPin, LOW);
    digitalWrite(pulPin, HIGH);
    lastTime = micros();
  }
}

