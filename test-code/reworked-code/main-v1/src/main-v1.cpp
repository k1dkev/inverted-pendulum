// Works with physical push buttons

#include "LCD_UI.h"
#include "Arduino.h"
#include <LiquidCrystal.h>
#include "digital_input.h"
#include "P3Encoder.h"
#include "BiPolarStepper.h"
#include "timers.h"

// HEADER FROM INTERTED MAIN

unsigned long startTime; // ms
float avgReading;
unsigned long N;
int sensorReading;

P3Encoder sensor(A8);
BiPolarStepper stepper(7,6,5,8);

unsigned long t; // us
unsigned long lastTime; // us
unsigned long closeTime; // us
unsigned long farTime; // us
unsigned long swingStartTime; //us

unsigned long measInterval = 10000; //ms
unsigned long sensorInterval = 10000; //us 1000 Hz
unsigned long closeInterval = 3000000; // us
unsigned long farInterval = 500000; // us

float x = 0.0;
float v = 0.0;
float theta = PI;
float thetadot = 0.0;
float u = 0.0;
float dt = 0.0;
float E = 0.0;
float Ix = 0.0;
float swingDT = 0.0;

float stateArray[4];
///////////////////////////////////////////////////////////////////////
unsigned long globalCurrentTime = 0;
ton tonSensorTimer(sensorInterval, &globalCurrentTime);
ton tonSwingUpTimer(25000000, &globalCurrentTime); // max time doesn't matter

int enterPin = 13;
int upPin = 10;
int downPin = 9;

enum States {MAIN_MENU, CALIBRATE, SWING_UP, BALANCE};
char *options[] = {"Swing up", "Balance", "Calibrate"};
States stateOptionArray[] = {SWING_UP, BALANCE, CALIBRATE};
States state = MAIN_MENU;
States lastState = CALIBRATE; // Make sure lastState != state as initial value
States nextState = MAIN_MENU;
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
digital_input enterPB(enterPin, 50000, 50000, &globalCurrentTime, INPUT_PULLUP);
digital_input upPB(upPin, 50000, 50000, &globalCurrentTime, INPUT_PULLUP);
digital_input downPB(downPin, 50000, 50000, &globalCurrentTime, INPUT_PULLUP);
LCD_UI ui(options, 3, &lcd);

// Function declarations
States main_menu(void);
States calibrate(void);
States balance(void);
States swing_up(void);
float swingUp(float x, float v, float theta, float thetadot, float swingDT);
bool canBalance(float x, float v, float theta, float thetadot);
int sign(float val);
float pendE(float theta, float thetadot);


void setup() {
    lcd.begin(16,2);
    pinMode(enterPin,INPUT_PULLUP);
    pinMode(upPin,INPUT_PULLUP);
    pinMode(downPin,INPUT_PULLUP);
}

void loop() {
    globalCurrentTime = micros();
    switch (state) {
        case MAIN_MENU: nextState = main_menu(); break;
        case CALIBRATE: nextState = calibrate(); break;
        case BALANCE:   nextState = balance();   break;
        case SWING_UP:  nextState = swing_up();  break;
        default: break;
    }
    lastState = state;
    state = nextState;
}

States main_menu() {
    if (lastState != state) {
        lcd.clear();
        ui.print();
    }
    enterPB.update();
    upPB.update();
    downPB.update();
    if (enterPB._risingEdge) return stateOptionArray[ui.getIndex()];
    if (downPB._risingEdge) ui.down();
    if (upPB._risingEdge) ui.up();
    return MAIN_MENU;
}

States balance() {
    if (lastState != state) {
        lcd.clear();
        lcd.print("BALANCE STATE");
    }
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;
	return BALANCE;
}

States calibrate() {
    if (lastState != state) {
        lcd.clear();
        lcd.print("CALIBRATE");
    }
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;
	return CALIBRATE;
}

States swing_up() {
    // Transition into swing up state
    if (lastState != state) { 
        lcd.clear(); 
        lcd.print("SWING_UP STATE"); 
        tonSwingUpTimer.reset();
        tonSensorTimer.reset();
    }
    
    // Return to main menu if enter key is pressed
    enterPB.update();
    if (enterPB._risingEdge) return MAIN_MENU;

    // Swing up loop
    tonSensorTimer.update(true);
    tonSwingUpTimer.update(true);
    if (tonSensorTimer._Q) {
        tonSensorTimer.reset();
        sensor.update();
        x = stepper.getX();
        v = stepper.getV();
        theta = sensor._theta;
        thetadot = sensor._thetadot;
        dt = sensor._dt;
        swingDT = ((float)tonSwingUpTimer._ET)/1000000.0;
        u = swingUp(x, v, theta, thetadot, swingDT);
        stepper.accel(u, dt);
        if (canBalance(x, v, theta, thetadot)) {
            return BALANCE;
        }
    }
    stepper.run();

	return SWING_UP;
}

float swingUp(float x, float v, float theta, float thetadot, float swingDT){
    float ksu = 600.0;
    float kcw = 1.37*ksu;
    float Lt = 150;
    float a = 0.65 + 0.1/25.0*swingDT;
    float E = pendE(theta, thetadot);
    float Eup = 133157.016;
    float Kx = 1.0;
    float Kv = 1.5;
    if (E <= a*Eup) {
        return -ksu*sign(thetadot*cos(theta)) + kcw*sign(x)*log(1 - abs(x)/Lt);
    } else {
        return -(Kx*x + Kv*v); // pushes cart towards the center
    }
}

bool canBalance(float x, float v, float theta, float thetadot){
    // if ( abs(x) <= 75.0 && abs(v) <= 150.0 && abs(theta) <= 3.0*PI/180.0 && abs(thetadot) < .369) {
    if ( abs(theta) <= 5.0*PI/180.0 ) {
        return true;
    } else {
        return false;
    }
}

int sign(float val)
{
    if (val < 0) return -1;
    if (val==0) return 0;
    return 1;
}

float pendE(float theta, float thetadot) {
    float Ih = 2676.83; // kgmm^2
    float g = 9810.0; // mm/s^2
    float m = .094; // kg
    float L = 144.4;  //mm
    return 0.5*Ih*pow(thetadot,2) + m*g*L*cos(theta);
}