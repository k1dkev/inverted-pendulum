# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21 # Effective Pendulum length
L = 144.4 # hinge to CoM length
Lt = 250 # Half the track length
m = .094 #kg
Ih = 2676.83 #kgmm^2

# LQR Weights
qx = 10
qv = .05
qt = 100
qw = 1
r = .5 # original r was .005 

# qx = 0
# qv = .1
# qt = 1
# qw = 0
# r = 10 # original r was .005

# Finding K
A = np.array([[0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1], [0, 0, g/Le, 0] ])
B = np.array([
		[0    ],
		[1    ],
		[0    ],
		[-1/Le]
		])
Q = np.diag([qx, qv, qt, qw])
R = np.array([r])
S = scipy.linalg.solve_continuous_are(A, B, Q, R)
K = np.matmul(np.transpose(B),S)/R
print("Gain Matrix K")
print(K)

# Initial Conditions
x0 = 0
v0 = 0
theta0 = (math.pi/180)*3 # Offset in degrees
#w0 = np.sqrt(2*m*g*L*(1 - np.cos(theta0))/Ih) # angular velocity after falling 3 degs from rest
w0 = 0.1

# Setting up time vector and initial conditions
t, dt = np.linspace(0,5,10000, retstep=True)
x = np.empty((t.size,4))
u = np.empty(t.size)
x[0,:] = np.array([[x0, v0, theta0, w0]])

# Balance control
def LQR(K, x):
	return -np.matmul(K,x)

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
for i, _ in enumerate(t):
	u[i] = LQR(K, x[i,:])
	x[i+1,:] = rk4(x[i,:], xdot, u[i], dt)
	if i == t.size - 2:
		u[i+1] = LQR(K, x[i+1,:])
		break

plt.figure(1)

plt.subplot(321)
plt.plot(t,x[:,0],'r-',linewidth=1)
plt.ylabel('x')

plt.subplot(322)
plt.plot(t,x[:,1],'r-',linewidth=1)
plt.ylabel('v')

plt.subplot(323)
plt.plot(t,x[:,2]*180/math.pi,'r-',linewidth=1)
plt.ylabel('theta(degrees)')

plt.subplot(324)
plt.plot(t,x[:,3],'r-',linewidth=1)
plt.ylabel('w')

plt.subplot(325)
plt.plot(t,u,'r-',linewidth=1)
plt.ylabel('u')

plt.show()