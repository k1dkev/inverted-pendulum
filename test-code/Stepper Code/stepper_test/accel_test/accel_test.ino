int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
bool lastDir = HIGH;
long lastTime = 0;
int stepTime = 10000; // Micro seconds
bool accel = true;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
  lastTime = micros();
}

void loop() {
  if ( (micros() - lastTime) > stepTime ) {
    digitalWrite(pulPin, LOW);
    digitalWrite(pulPin, HIGH);
    if (accel) {
      stepTime = stepTime - 10;
      if (stepTime < 1000) {
        accel = false;
      }
    } else {
      stepTime = stepTime + 10;
      if (stepTime > 10000) {
        accel = true;
      }
    }
    lastTime = micros();
  }
}

