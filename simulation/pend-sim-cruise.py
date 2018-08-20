# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

def energyOfPend(x):
	T = .5*Ih*(x[3])**2
	V = m*g*L*np.cos(x[2])
	return T+V

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21 # Effective Pendulum length
Lt = 250 # Half the track length
Ih = 2676.83 # kgmm^2
m = .094 #kg
L = 144.4 #mm
Eup = energyOfPend(np.array([0,0,0,0]))
print("Eup: ", Eup)

# Initial Conditions
x0 = 50
v0 = 0
theta0 = (math.pi/180)*180 # Starting from bottom position
w0 = 14.11

# Setting up time vector and initial conditions
t, dt = np.linspace(0,15,100000, retstep=True)
x = np.empty((t.size,4))
u = np.empty(t.size)
E = np.empty(t.size)
x[0,:] = np.array([[x0, v0, theta0, w0]])

def angleBound(theta):
	if theta >= 0:
		theta = theta%(2*np.pi)
	else:
		theta = theta%(2*np.pi) + 2*np.pi
	return theta

# Swing up control
def swingUp(x):
	ksu = 600
	kcw = 1.37*ksu
	if energyOfPend(x) >= Eup:
		return 0
	else:
		return -ksu*np.sign(x[3]*np.cos(x[2])) + kcw*np.sign(x[0])*np.log(1 - np.absolute(x[0])/Lt)

def cruise(x):
	ksu = 600
	kcw = 1.37*ksu
	kvw = 3.04*ksu
	kem = 3.66*ksu
	n = 1.05
	vmax = 320
	ucw = kcw*np.sign(x[0])*np.log(1 - np.absolute(x[0])/Lt)
	# print("ucw: ", ucw)
	uvw = kvw*np.sign(x[0])*np.log(1 - np.absolute(x[0])/vmax)
	# print("uvw: ", uvw)
	Erp = energyOfPend(x)
	# print("Erp: ", Erp)
	uem = kem*(np.exp(np.absolute(Erp - n*Eup)/15000) - 1)*np.sign(Erp - Eup)*np.sign(x[3]*np.cos(x[2]))
	# print("uem: ", uem)
	return ucw+uvw+uem

print("u: ", cruise(x[0,:]))

# xdot
def xdot(x, u):
	# print("Inside of xdot")
	# print(x)
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (g*np.sin(x[2]) - u*np.cos(x[2]))/Le
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
	u[i] = cruise(x[i,:])
	E[i] = energyOfPend(x[i,:])
	x[i+1,:] = rk4(x[i,:], xdot, u[i], dt)
	if i == t.size - 2:
		u[i+1] = cruise(x[i+1,:])
		E[i+1] = energyOfPend(x[i+1,:])
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

plt.subplot(326)
plt.plot(t,E,'r-',linewidth=1)
plt.ylabel('E')

plt.show()