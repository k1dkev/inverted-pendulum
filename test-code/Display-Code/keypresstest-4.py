# pylint: disable = all
import sys, tty, termios, serial

try:
	ser = serial.Serial('/dev/cu.usbmodem1411', 9600, timeout=1)
except:
	print("serial failed")
	sys.exit(0)

ENTER_KEY = 10
LEFT_CARRAT = 44
RIGHT_CARRAT = 46
EXIT_KEY = 101
try:
	old_settings = termios.tcgetattr(sys.stdin)
	tty.setcbreak(sys.stdin) 
except:
	print("setcbreak failed")
	sys.exit(0)

try: 
	while True:
		# print_buffer(ser)
		key = ord(sys.stdin.read(1))
		if key == ENTER_KEY:
			# print("Enter")
			ser.write(b'E\n')
		elif key == LEFT_CARRAT:
			# print("Left Carrat")
			ser.write(b'L\n')
		elif key == RIGHT_CARRAT:
			# print("Right Carrat")
			ser.write(b'R\n')
		elif key == EXIT_KEY:
			# print("Exit")
			break

		line = 'A'
		while (line != ''):
			line = ser.readline().decode('ascii') 
			if line != '':
				print(line)
except:
	print("while loop failed")
finally:
	ser.close()
	termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
	sys.exit(0)

def print_buffer(ser):
	line = ser.readline().decode('ascii')
	if line == '':
		return 1
	else:
		print_buffer(ser)