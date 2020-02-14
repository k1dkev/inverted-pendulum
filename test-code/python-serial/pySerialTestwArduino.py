# pylint: disable = all
import serial
import time

with serial.Serial('COM5', 115200, timeout=1) as ser:
    while True:
        while ser.in_waiting:
            line = ser.readline().decode('ascii')
            print(line)
    # for i in range(0,10):
	# 	ser.write(b'Hello! yesssss\n')
	# 	line = ser.readline().decode('ascii')   # read a '\n' terminated line
	# 	print(line)