#include <BiPolarStepper.h>
BiPolarStepper stepper(7,6,5,2);

void setup() {
  stepper.setW(6.0);
  stepper._done = false;
}

void loop() {
  stepper.run();
}
