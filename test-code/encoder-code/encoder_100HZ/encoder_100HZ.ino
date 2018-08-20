int analogPin = A0;        
int sensorRead;
float maxSensorOutput = 887;
int correctedRead;
float downPosition = 777.5;
float offset = downPosition - maxSensorOutput/2.0;
float angleDeg;
float theta;
float lastTheta = 180.0;
float vel;
int count = 0;

void setup(){
  // Timer Setup runs at 100Hz
  cli();//stop interrupts
  TCCR1A = 0;// set entire TCCR1A register to 0
  TCCR1B = 0;// same for TCCR1B
  TCNT1  = 0;//initialize counter value to 0
  OCR1A = 2499;// compare match register (16 MHz) / (100Hz*64) - 1 (must be <65536)
  TCCR1B |= (1 << WGM12); // turn on CTC mode
  TCCR1B |= (1 << CS11) | (1 << CS10); // Set CS12 and CS10 bits for 64 prescaler
  TIMSK1 |= (1 << OCIE1A); // enable timer compare interrupt
  sei();//allow interrupts

  // Angle Sensor Setup
  pinMode(analogPin, INPUT); 
  Serial.begin(9600);
  //downPosition = analogRead(analogPin);
  //offset = (float)downPosition - (float)maxSensorOutput/2.0;
}//end setup

ISR(TIMER1_COMPA_vect){//timer1 interrupt 1Hz toggles pin 13 (LED)
//generates pulse wave of frequency 1Hz/2 = 0.5kHz (takes two cycles for full wave- toggle high then toggle low)
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
  if (count >= 10) {
    //Serial.println("angle:    " + String(theta));
    Serial.println("velocity: " + String(vel));
    count = 0;
  }
  lastTheta = theta;
  count ++;
}
  
void loop(){
  //do other things here
}

static inline int8_t sgn(float val) {
 if (val < 0) return -1;
 if (val==0) return 0;
 return 1;
}

