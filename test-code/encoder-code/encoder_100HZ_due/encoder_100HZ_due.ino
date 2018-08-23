int analogPin = A8;        
int sensorRead;
float maxSensorOutput = 887;
int correctedRead;
float downPosition = 777.5;
float offset = downPosition - maxSensorOutput/2.0;
float angleDeg;
float theta;
float lastTheta = 180.0;
float vel;
unsigned long lastTime;
unsigned long t;

void setup(){
  // Angle Sensor Setup
  pinMode(analogPin, INPUT);
  analogReadResolution(12);
  Serial.begin(19200);
  lastTime = millis();
}

void loop(){
  t = millis();
  if ( (t - lastTime) > 10 ) {
    sensorRead = analogRead(analogPin);
    theta = 359.59*( (float)sensorRead - offset)/( maxSensorOutput);
    if (theta >= 180.0) {
      theta = theta - 360;
    } else if ( theta < -179.59 ) {
      theta = theta + 360;
    }
    if (sgn(theta)*sgn(lastTheta) < 0 && abs(theta) > 90) {
      vel = 100*(theta + lastTheta);
    } else {
      vel = 100*(theta - lastTheta);
    }
    // Serial.println("angle:    " + String(sensorRead));
    Serial.println(sensorRead);
    // Serial.println("lastTime: " + String(lastTime));
    //Serial.println("velocity: " + String(vel));
    lastTheta = theta;
    lastTime = t;
  }
}

static inline int8_t sgn(float val) {
 if (val < 0) return -1;
 if (val==0) return 0;
 return 1;
}

