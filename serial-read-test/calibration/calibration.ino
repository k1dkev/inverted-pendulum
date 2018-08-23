#include "P3Encoder.h"
#include "BiPolarStepper.h"

const byte numChars = 32;
char receivedChars[numChars];   // an array to store the received data
unsigned int state = 000; // Note this is base 8 numbers
boolean newData = false;

unsigned long startTime;
float avgReading;
unsigned long N;
int sensorReading;

P3Encoder sensor(A8);
BiPolarStepper stepper(7,6,5,8);

unsigned long t; // ms
unsigned long lastTime; // ms
unsigned long closeTime;
unsigned long farTime;

float x = 0.0;
float v = 0.0;
float theta = PI;
float thetadot = 0.0;
float u = 0.0;
float dt = 0.0;

bool isClose = false;

void setup() {
    Serial.begin(115200);
    lastTime = millis();
}

void loop() {
    switch (state) {
        case 000:
            Serial.println("Starting Calibration Setup...");
            state = 001;
            break;

        case 001:
            Serial.println("Do you wish to calibrate? (y/n)");
            while(true){
                recvWithEndMarker();
                if (newData) {
                    Serial.println(">>> " + String(receivedChars));
                    newData = false;
                    if (*receivedChars == 'y') {
                        state = 002;
                    } else if (*receivedChars == 'n') {
                        state = 006;
                    } else {
                        Serial.println(String(receivedChars) + " is not a valid input. Try again...");
                    }
                    break;
                }
            }
            break;

        case 002:
            Serial.println("(1) Attach the pendulum so that the set screw is on the LEFT side.");
            Serial.println("(2) Let pendulum come to rest in the downward position.");
            Serial.println("(3) Send 'go' when ready.");
            while(true){
                recvWithEndMarker();
                if (newData) {
                    Serial.println(">>> " + String(receivedChars));
                    newData = false;
                    if (strcmp(receivedChars,"go") == 0) {
                        state = 003;
                    } else {
                        Serial.println(String(receivedChars) + " is not a valid input. Try again...");
                    }
                    break;
                }
            }
            break;

        case 003:
            Serial.println("Measuring the upright position (10 sec)...");
            startTime = millis();
            avgReading = 0;
            N = 1;
            while (true) {
                sensorReading = sensor.readRaw();
                avgReading = (((float)N - 1.0)*avgReading + (float)sensorReading)/((float)N);
                N++;
                if ( millis() - startTime >= 10*1000) break; 
            }
            sensor.setVup(avgReading);
            Serial.println("Number of measurements: " + String(N-1));
            Serial.println("Average UPRIGHT position (Vup): " + String(avgReading));
            state = 004;
            break;

        case 004:
            Serial.println("(1) Attach the pendulum so that the set screw is on the RIGHT side.");
            Serial.println("(2) Let pendulum come to rest in the downward position.");
            Serial.println("(3) Send 'go' when ready.");
            while(true){
                recvWithEndMarker();
                if (newData) {
                    Serial.println(">>> " + String(receivedChars));
                    newData = false;
                    if (strcmp(receivedChars,"go") == 0) {
                        state = 005;
                    } else {
                        Serial.println(String(receivedChars) + " is not a valid input. Try again...");
                    }
                    break;
                }
            }
            break;

        case 005:
            Serial.println("Measuring the DOWNWARD position (10 sec)...");
            startTime = millis();
            avgReading = 0;
            N = 1;
            while (true) {
                sensorReading = sensor.readRaw();
                avgReading = (((float)N - 1.0)*avgReading + (float)sensorReading)/((float)N);
                N++;
                if ( millis() - startTime >= 10*1000) break; 
            }
            sensor.setVd(avgReading);
            Serial.println("Number of measurements: " + String(N-1));
            Serial.println("Average DOWNWARD position (Vd): " + String(avgReading));
            Serial.println("Calibartion Complete.");
            state = 006;
            break;

        case 006:
            Serial.println("Start swing up loop? (y/n)");
            while(true){
                recvWithEndMarker();
                if (newData) {
                    Serial.println(">>> " + String(receivedChars));
                    newData = false;
                    if (*receivedChars == 'y') {
                        state = 010;
                    } else if (*receivedChars == 'n') {
                        state = 020;
                    } else {
                        Serial.println(String(receivedChars) + " is not a valid input. Try again...");
                    }
                    break;
                }
            }
            break;

        case 010:
            Serial.println("Swinging Up...");
            state = 020;
            break;

        case 020:
            Serial.println("Bring the pendulum to the origin and hold it for 3 seconds...");
            closeTime = millis();
            t = millis();
            while(true) {
                t = millis();
                if ( (t - lastTime) >= 100 ) {
                    sensor.update();
                    x = stepper.getX();
                    v = stepper.getV();
                    theta = sensor._theta;
                    thetadot = sensor._thetadot;
                    if (!closeToOrigin(x, v, theta, thetadot)) closeTime = millis();
                    lastTime = t;
                }
                if ( (t - closeTime) >= 3000 ) {
                    state = 021;
                    stepper.unStop();
                    break;
                }
            }
            break;

        case 021:
            Serial.println("Balancing...");
            farTime = micros();
            lastTime = micros();
            while(true) {
                t = micros();
                if ( (t - lastTime) >= 10000 ) {
                    sensor.update();
                    x = stepper.getX();
                    v = stepper.getV();
                    theta = sensor._theta;
                    thetadot = sensor._thetadot;
                    dt =sensor._dt;
                    u = balanceLQR(x, v, theta, thetadot);
                    stepper.accel(u, dt);
                    if (!farFromOrigin(x, v, theta, thetadot)) farTime = micros();
                    lastTime = t;
                }
                // if ( (t - farTime) >= 500000 ) {
                //     state = 010;
                //     stepper.stop();
                //     break;
                // }
                stepper.run();
            }
            break;

        // case 666:
        //     Serial.println("Reading sensor at 100 HZ");
        //     while(true) {
        //         t = millis();
        //         if ( (t - lastTime) >= 10 ) {
        //             sensor.update();
        //             Serial.print("theta: ");
        //             Serial.print(sensor._theta);
        //             Serial.print(". thetadot: ");
        //             Serial.println(sensor._thetadot);
        //             lastTime = t;
        //         }
        //     }
        //     break;
        // case 777:
        //     Serial.println("Next State");
        //     break;
        default:
            break;
}
}

void recvWithEndMarker() {
    static byte ndx = 0;
    char endMarker = '\n';
    char rc;
    
    while (Serial.available() > 0 && newData == false) {
        rc = Serial.read();

        if (rc != endMarker) {
            receivedChars[ndx] = rc;
            ndx++;
            if (ndx >= numChars) {
                ndx = numChars - 1;
            }
        }
        else {
            receivedChars[ndx] = '\0'; // terminate the string
            ndx = 0;
            newData = true;
        }
    }
}

void showNewData() {
    if (newData == true) {
        Serial.print("This just in ... ");
        Serial.println(receivedChars);
        newData = false;
    }
}

char* getNewData() {
    newData = false;
    return receivedChars;
}

int readSensor() {
    return analogRead(A8);
}

bool closeToOrigin(float x, float v, float theta, float thetadot){
    if ( abs(x) <= 5.0 && abs(v) <= 10.0 && abs(theta) <= 3.0*PI/180.0 && abs(thetadot) < .369) {
        return true;
    } else {
        return false;
    }
}

bool farFromOrigin(float x, float v, float theta, float thetadot){
    if ( abs(theta) >= 45*PI/180.0) {
        return true;
    } else {
        return false;
    }
}

// float balanceLQR(float x, float v, float theta, float thetadot){
//     return 400.0*theta/PI;
// }

float balanceLQR(float x, float v, float theta, float thetadot){
    float Kx = -4.472;
    float Kv = -5.621;
    float Kt = -33492.0;
    float Kw = -4749.;
    return -(Kx*x + Kv*v + Kt*theta + Kw*thetadot);
}