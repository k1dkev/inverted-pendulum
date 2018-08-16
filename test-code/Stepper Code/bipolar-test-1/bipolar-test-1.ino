#include <BiPolarStepper.h>
BiPolarStepper stepper(7,6,5,2);

void setup() {
  stepper.setW(6.0);
  stepper.setDesiredStep(800);
}

void loop() {
  if (stepper._done) { 
    stepper.setDesiredStep(0);
  }
  stepper.oneStep();
}
