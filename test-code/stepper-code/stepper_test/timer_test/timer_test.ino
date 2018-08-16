//https://www.instructables.com/id/Arduino-Timer-Interrupts/
//timer1 will interrupt at 1Hz

// variables
bool toggle = 0;
const int ledPin = 13;
int count = 0;

void setup(){
  pinMode(ledPin, OUTPUT);

  cli();//stop interrupts
  //set timer1 interrupt at 1Hz
  TCCR1A = 0;// set entire TCCR1A register to 0
  TCCR1B = 0;// same for TCCR1B
  TCNT1  = 0;//initialize counter value to 0
  OCR1A = 2499;// compare match register (16*10^6) / (1*1024) - 1 (must be <65536)
  TCCR1B |= (1 << WGM12); // turn on CTC mode
  TCCR1B |= (1 << CS11) | (1 << CS10); // Set CS12 and CS10 bits for 1024 prescaler
  TIMSK1 |= (1 << OCIE1A); // enable timer compare interrupt
  sei();//allow interrupts

}//end setup

ISR(TIMER1_COMPA_vect){//timer1 interrupt 1Hz toggles pin 13 (LED)
//generates pulse wave of frequency 1Hz/2 = 0.5kHz (takes two cycles for full wave- toggle high then toggle low)
  count++;
  if (count == 100) {
    if (toggle){
      digitalWrite(13,HIGH);
      toggle = 0;
      count = 0;
    }
    else{
      digitalWrite(13,LOW);
      toggle = 1;
      count = 0;
    }
  }
}
  
void loop(){
  //do other things here
}
