#include "ton.h"
#include "tof.h"

unsigned long globalCurrentTime = 0;

// ton timer1(1000000, &globalCurrentTime);
ton timer2(10000000, &globalCurrentTime);
ton timer3(250000 , &globalCurrentTime);
tof timer4(2000000, &globalCurrentTime);

void setup() {
    Serial.begin(9600);
    timer4._RUN = false;
}

void loop() {
    globalCurrentTime = micros();

    // timer1.update();
    timer2.update();
    timer3.update();
    timer4.update();

    // if (timer1._Q) {
    // 	Serial.println("1s timer done");
    // 	timer1.reset();
    // }

    if (timer2._Q) {
    	Serial.println("10s timer done");
    	timer2.reset();
    }

    if (timer3._Q) {
    	timer3.reset();
    	Serial.print("2s TOF STATUS: ");
    	Serial.println(timer4._Q);
    	// Serial.print("2s TOF RT: ");
    	// Serial.println(timer4._RT);
    }

    if (timer2._Q) timer4.reset();

}