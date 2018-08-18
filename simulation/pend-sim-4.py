# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math

# Parameters
g = 9810 # mm/s^2
Le = 197.21

# Setting up time vector and initial conditions
t, dt = np.linspace(0,14,10000, retstep=True)
x = np.array([0])
v = np.array([0])
theta = np.array([math.pi/2])
w = np.array([0])

# Looping over time vector and Simulating Dynamics
u = 0
for _ in t:
	xdot = v[-1]
	vdot = u
	thetadot = w[-1]
	wdot = (g*math.sin(theta[-1]) - u*math.cos(theta[-1]))/Le

	xnew = x[-1] + xdot*dt
	vnew = v[-1] + vdot*dt
	thetanew = theta[-1] + thetadot*dt
	wnew = w[-1] + wdot*dt

	x = np.append(x, xnew)
	v = np.append(v, vnew)
	theta = np.append(theta, thetanew)
	w = np.append(w, wnew)


# Adding one more element to time vector so it is the same length as x
t = np.append(t, t[-1] + dt)

plt.figure(1)
plt.plot(t,theta,'r-',linewidth=1,label='theta')
plt.xlabel('Time')
plt.ylabel('Response')
plt.legend(loc='best')
plt.show()