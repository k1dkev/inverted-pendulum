int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
float sr = 200.0; // steps per rev
float sm = 2.0; // Step mode 1/4 stepping
float k = 2000000.0*PI/(sm*sr); // constant for converting velocity to stepTime
float w = 1.0; // initial angular velocity of 1 rad/s
float stepTime = k/w; // initial stepTime in micro seconds
float alpha = 30.0; // angular accel rad/s^2
unsigned long lastTime = 0; // for not interupting function of stepper
unsigned long lastTimeDt = 0; // for not interupting function of stepper
bool accel = true; // 
float dt = 0.0; // Time since last update of angular acceleration

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, HIGH);
  //Serial.begin(1000000);
  lastTime = micros();
}

void loop() {
  if ( (micros() - lastTime) > stepTime ) {
    digitalWrite(pulPin, LOW);
    digitalWrite(pulPin, HIGH);
    lastTime = micros();
    if (accel) {
      dt = ((float)micros() - (float)lastTimeDt)/1000000.0;
      lastTimeDt = micros();
      w = w + alpha*dt;
      stepTime = k/w;
      if (w > 100) {
        accel = false;
      }
    } else {
      dt = ((float)micros() - (float)lastTimeDt)/1000000.0;
      lastTimeDt = micros();
      w = w - alpha*dt;
      stepTime = k/w;
      if (w < 1) {
        accel = true;
      }
    }
  }
}

