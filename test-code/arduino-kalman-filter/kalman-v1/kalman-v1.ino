int i = 0;
unsigned long startTime;
unsigned long t;          // Current time
float x;

void setup() {
  Serial.begin(9600);
  startTime = millis();
}

void loop() {
  t = millis() - startTime;
  x = sin(4.0 * t / 1000.0);
//  i++;
//  if (i > 100) {
//    i = 0;
//  }
  Serial.println(x);
}
