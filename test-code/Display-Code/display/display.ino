#include <LiquidCrystal.h>
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
	lcd.begin(16,2);
	lcd.print("Hey Girl...");
	lcd.setCursor(0, 1);
	lcd.print("Lemme Smang it");
}

void loop() {

}