int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
bool lastDir = HIGH;
unsigned long lastTime = 0;
long stepTime = 50000; // Micro seconds
bool accel = true;
float alpha = 1.0/60.0;
float dt = 0.0;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
  //Serial.begin(1000000);
  lastTime = micros();
}

void loop() {
  if ( (micros() - lastTime) > stepTime ) {
    digitalWrite(pulPin, LOW);
    digitalWrite(pulPin, HIGH);
    if (accel) {
      dt = ((float)micros() - (float)lastTime)/1000000.0;
      stepTime = 1/( 1/(float)stepTime + alpha*dt*800.0/500000.0*3.14);
      //Serial.println(stepTime);
      if (stepTime < 100) {
        accel = false;
      }
    } else {
      dt = ((float)micros() - (float)lastTime)/1000000.0;
      stepTime = 1/( 1/(float)stepTime - alpha*dt*800.0/500000.0*3.14);
      //Serial.println(dt, 10);
      //Serial.println(stepTime);
      //Serial.println(lastTime);
      if (stepTime > 10000) {
        accel = true;
      }
    }
    lastTime = micros();
  }
}

