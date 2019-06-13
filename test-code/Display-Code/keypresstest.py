# pylint: disable = all
import sys,tty, termios
old_settings = termios.tcgetattr(sys.stdin)
tty.setcbreak(sys.stdin)  
key = ord(sys.stdin.read(1))  # key captures the key-code 
# based on the input we do something - in this case print something
if key==97:
    print("you pressed a")
else:
    print("you pressed something else ...")
termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
sys.exit(0)