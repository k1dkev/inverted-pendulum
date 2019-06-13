# pylint: disable = all
import serial

with serial.Serial('/dev/cu.usbmodem1411', 9600, timeout=1) as ser:
	for i in range(0,10):
		ser.write(b'Hello! yesssss\n')
		line = ser.readline().decode('ascii')   # read a '\n' terminated line
		print(line)