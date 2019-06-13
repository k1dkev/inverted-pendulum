int calibrate(int step) {
	switch (step) {
	    case 000:
	        Serial.println("Starting Calibration Setup...");
	        step = 001;
	        break;

	    case 001:
	        Serial.println("Do you wish to calibrate? (y/n)");
	        while(true){
	            recvWithEndMarker();
	            if (newData) {
	                Serial.println(">>> " + String(receivedChars));
	                newData = false;
	                if (*receivedChars == 'y') {
	                    step = 002;
	                } else if (*receivedChars == 'n') {
	                    step = 006;
	                    state = BALANCE;
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
	                    step = 003;
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
	            if ( millis() - startTime >= measInterval) break; 
	        }
	        sensor.setVup(avgReading);
	        Serial.println("Number of measurements: " + String(N-1));
	        Serial.println("Average UPRIGHT position (Vup): " + String(avgReading));
	        step = 004;
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
	                    step = 005;
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
	            if ( millis() - startTime >= measInterval) break; 
	        }
	        sensor.setVd(avgReading);
	        Serial.println("Number of measurements: " + String(N-1));
	        Serial.println("Average DOWNWARD position (Vd): " + String(avgReading));
	        Serial.println("Calibartion Complete.");
	        step = 006;
	        break;
	}
	return step;
}