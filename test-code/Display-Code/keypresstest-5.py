# pylint: disable = all
import sys, tty, termios, serial

# opening serial connection
try:
	ser = serial.Serial('/dev/cu.usbmodem1411', 9600, timeout=1)
except:
	print("serial failed")
	sys.exit(0)

# ASCII int representations of keys
ENTER_KEY = 10
LEFT_CARRAT = 44
RIGHT_CARRAT = 46
EXIT_KEY = 101

# This changes standard in to not require an enter press before sending line to code.
# Allows the code to read each key press imediately
try:
	old_settings = termios.tcgetattr(sys.stdin)
	tty.setcbreak(sys.stdin) 
except:
	print("setcbreak failed")
	sys.exit(0)

try: 
	while True:
		# Reading in key press and writing to arduino which key was pressed
		key = ord(sys.stdin.read(1))
		if key == ENTER_KEY:
			ser.write(b'E\n')
		elif key == LEFT_CARRAT:
			ser.write(b'L\n')
		elif key == RIGHT_CARRAT:
			ser.write(b'R\n')
		elif key == EXIT_KEY:
			break

		# Reads lines from arduino until line is empty
		line = 'A'
		while (line != ''):
			line = ser.readline().decode('ascii') 
			if line != '':
				print(line)
except:
	print("while loop failed")
finally:
	# Closes serial connection and sets terminal settings back to normal
	ser.close()
	termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
	sys.exit(0)

def print_buffer(ser):
	line = ser.readline().decode('ascii')
	if line == '':
		return 1
	else:
		print_buffer(ser)