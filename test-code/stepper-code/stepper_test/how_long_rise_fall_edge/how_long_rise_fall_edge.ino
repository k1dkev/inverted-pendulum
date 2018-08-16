int enaPin = 7; // Enable Pin
int dirPin = 6; // Direction Pin
int pulPin = 5; // Pulse Pin
int stepsPerRev = 800; // 1/4 Stepping
bool lastDir = HIGH;
long t = 0;
long dt = 0;

void setup() {
  pinMode(enaPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  pinMode(pulPin, OUTPUT);
  digitalWrite(enaPin, LOW); // Motor is on by default
  digitalWrite(dirPin, lastDir);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(pulPin, LOW);
  t = micros();
  digitalWrite(pulPin, HIGH);
  dt = micros() - t;
  Serial.println(dt);
}

