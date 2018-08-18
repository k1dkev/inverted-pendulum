# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math

# Parameters
g = 9810 # mm/s^2
Le = 197.21

# Setting up time vector and initial conditions
t, dt = np.linspace(0,14,10000, retstep=True)
x = np.empty((t.size,4))
x[0,:] = np.array([[0,0,math.pi/2,0]])

# xdot
def xdot(x,u):
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (g*math.sin(x[2]) - u*math.cos(x[2]))/Le
	return np.array([Xdot, vdot, thetadot, wdot])

# Looping over time vector and Simulating Dynamics
u = 0
for i, _ in enumerate(t):
	x[i+1,:] = x[i,:] + xdot(x[i,:],u)*dt
	if i == t.size - 2:
		break

plt.figure(1)
plt.plot(t,x[:,2],'r-',linewidth=1,label='theta')
plt.xlabel('Time')
plt.ylabel('Response')
plt.legend(loc='best')
plt.show()