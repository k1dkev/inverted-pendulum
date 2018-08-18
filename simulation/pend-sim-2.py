# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import odeint

# Simulate taup * dy/dt = -y + K*u
Kp = 3.0
taup = 2.0

# (3) ODE Integrator
def model(y,t):
    u = 1
    return (-y + Kp * u)/taup
t = np.linspace(0,14,100)
y = odeint(model,0,t)

plt.figure(1)
plt.plot(t,y,'r-',linewidth=1,label='ODE Integrator')
plt.xlabel('Time')
plt.ylabel('Response (y)')
plt.legend(loc='best')
plt.show()