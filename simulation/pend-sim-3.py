# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt

# Simulate taup * dy/dt = -y + K*u
Kp = 3.0
taup = 2.0

# Setting up time vector
t, dt = np.linspace(0,14,100, retstep=True)

# Looping over time vector and Simulating Dynamics
x = np.array([0])
for _ in t:
	xdot = (-x[-1] + Kp)/taup
	xnew = x[-1] + xdot*dt
	x = np.append(x, xnew)

# Adding one more element to time vector so it is the same length as x
t = np.append(t, t[-1] + dt)

plt.figure(1)
plt.plot(t,x,'r-',linewidth=1,label='ODE Integrator')
plt.xlabel('Time')
plt.ylabel('Response (x)')
plt.legend(loc='best')
plt.show()