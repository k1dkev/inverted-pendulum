#include <UniStepper.h>

const int stepsPerRev = 512;
const int switch1 = x;
const int switch2 = x;
bool doOneRev1 = false;
bool doOneRev1 = false;
int stepCount1 = 0;
int stepCount2 = 0;

UniStepper stepper1(1,2,3,4);
UniStepper stepper2(5,6,7,8);

void setup() {
  stepper1.setRPM(15);
  stepper2.setRPM(15);
}

void loop() {
 if ( digitalRead(switch1) == HIGH) { 
  doOneRev1 = true;
 }
 if ( digitalRead(switch2) == HIGH) { 
  doOneRev2 = true;
 }

 if(doOneRev1) {
  stepper1.oneStep();
  stepCount1++;
  if (stepCount1 == stepsPerRev) {
    stepCount1 = 0;
    doOneRev1 = false;
  }
 }

 if(doOneRev2) {
  stepper2.oneStep();
  stepCount2++;
  if (stepCount2 == stepsPerRev) {
    stepCount2 = 0;
    doOneRev2 = false;
  }
 }
 
}

