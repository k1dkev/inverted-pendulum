int analogPin = A0;        
int sensorRead;
int maxSensorOutput = 887;
int correctedRead;
int downPosition;
int offset;
float angleDeg;
float theta;
float lastTheta = 180.0;
void setup()
{
  pinMode(analogPin, INPUT);
  Serial.begin(9600);
  downPosition = analogRead(analogPin);
  offset = downPosition - maxSensorOutput/2;
}

void loop()
{
  sensorRead = analogRead(analogPin);
  theta = 360.0*( (float)sensorRead - (float)offset)/( (float)maxSensorOutput);
  if (theta < 0) {
    theta = theta + 360;
  }
  Serial.println(theta);
}
