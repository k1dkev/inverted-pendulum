# pylint: disable = all
import sys,tty, termios
old_settings = termios.tcgetattr(sys.stdin)
tty.setcbreak(sys.stdin)  
key = ord(sys.stdin.read(1))  # key captures the key-code 
# based on the input we do something - in this case print something
for i in range(0, 100):
    if key==i:
        print("you pressed ",i)
termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
sys.exit(0)