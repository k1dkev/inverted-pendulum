#include "BiPolarStepper.h"
#include "P3Encoder.h"

BiPolarStepper stepper(7,6,5,2);
unsigned long lastTime;
unsigned long t;
void setup() {
  stepper.setV(-10.0);
  stepper._stop = false;
  //Serial.begin(9600);
  lastTime = millis();
}

void loop() {
  stepper.run();
  t = millis();
  if ((t - lastTime)> 10) {
    stepper.accel(-1000.0, .01);
    // Serial.println(stepper.getV());
    lastTime = t;
  }
}
