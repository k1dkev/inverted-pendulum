# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21

# Initial Conditions
x0 = 0
v0 = 0
theta0 = math.pi/2
w0 = 0

# Setting up time vector and initial conditions
t, dt = np.linspace(0,10,10000, retstep=True)
x = np.empty((t.size,4))
x[0,:] = np.array([[x0, v0, theta0, w0]])

# xdot
def xdot(x, u):
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (g*math.sin(x[2]) - u*math.cos(x[2]))/Le
	return np.array([Xdot, vdot, thetadot, wdot])

# rk4 updates x
def rk4(x, xdot, u, dt):
	k1 = xdot(x, u)*dt
	k2 = xdot(x + k1/2, u)*dt
	k3 = xdot(x + k2/2, u)*dt
	k4 = xdot(x + k3, u)*dt
	return x + (k1 + 2*k2 + 2*k3 + k4)/6

# Looping over time vector and Simulating Dynamics
u = 0
for i, _ in enumerate(t):
	x[i+1,:] = rk4(x[i,:], xdot, u, dt)
	if i == t.size - 2:
		break

plt.figure(1)

plt.subplot(221)
plt.plot(t,x[:,0],'r-',linewidth=1)
plt.ylabel('x')

plt.subplot(222)
plt.plot(t,x[:,1],'r-',linewidth=1)
plt.ylabel('v')

plt.subplot(223)
plt.plot(t,x[:,2],'r-',linewidth=1)
plt.ylabel('theta')

plt.subplot(224)
plt.plot(t,x[:,3],'r-',linewidth=1)
plt.ylabel('w')

plt.show()