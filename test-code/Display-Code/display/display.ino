#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

enum States {TESTCALL,HELLO};
States state = TESTCALL;

void setup() {
	lcd.begin(16,2);
	lcd.print("Hey Girl...");
	lcd.setCursor(0, 1);
	lcd.print("Lemme Smang it");
}

void loop() {
    switch (state) {
        case TESTCALL:
            testCall();
            state = 001;
            break;
        case HELLO:
			lcd.setCursor(0, 0);
			lcd.print("HELLO");
			break;	
        default:
        	break;
    }
}
