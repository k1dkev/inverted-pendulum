# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

#----------------------- Functions ---------------------#

# Balance control
def LQR(K, x):
	return 0
	return -np.matmul(K,x)

# xdot
def xdot(x, u):
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (g*math.sin(x[2]) - u*math.cos(x[2]))/Le
	return np.transpose(np.array([Xdot, vdot, thetadot, wdot]))

# rk4 updates x
def rk4(x, xdot, u, dt):
	k1 = xdot(x, u)*dt
	k2 = xdot(x + k1/2, u)*dt
	k3 = xdot(x + k2/2, u)*dt
	k4 = xdot(x + k3, u)*dt
	return x + (k1 + 2*k2 + 2*k3 + k4)/6

# Kalman Filter
def kalmanFilter(z_kp1, u, xplus_k, Pplus_k, dt, Q, R):
	theta_minus_kp1 = xplus_k[0] + xplus_k[1]*dt
	omega_minus_kp1 = xplus_k[1] + (g*math.sin(xplus_k[0]) - u*math.cos(xplus_k[0]))*dt/Le
	xminus_kp1 = np.array([theta_minus_kp1, omega_minus_kp1])
	F_kp1 = np.array([ [1,dt], [(g*math.cos(xminus_kp1[0]) + u*math.sin(xminus_kp1[0]))*dt/Le, 1] ])
	H_kp1 = np.array([1,0])
	Pminus_kp1 = F_kp1 @ Pplus_k @ F_kp1.T + Q
	nu_kp1 = z_kp1 - xminus_kp1[0]
	S_kp1 = H_kp1 @ Pminus_kp1 @ H_kp1.T + R
	K_kp1 = (Pminus_kp1 @ H_kp1.T)/S_kp1
	xplus_kp1 = xminus_kp1 + K_kp1*nu_kp1
	I = np.identity(2)
	Pplus_kp1 = (I - K_kp1 @ H_kp1) @ Pminus_kp1
	Pplus_kp1 = np.absolute(Pplus_kp1)
	return (xplus_kp1, Pplus_kp1)

#------------------------- Inputs ----------------------#

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21 # Effective Pendulum length
L = 144.4 # hinge to CoM length
Lt = 250 # Half the track length
m = .094 #kg
Ih = 2676.83 #kgmm^2
K = 0

# Initial Conditions
x0 = 0
v0 = 0
theta0 = (math.pi/180)*3 # Offset in degrees
# w0 = np.sqrt(2*m*g*L*(1 - np.cos(theta0))/Ih) # angular velocity after falling 3 degs from rest
w0 = 0

# Time and frequencies
tFinal = 10
tInitial = 0
Nsteps = 10000
kalmanFrequency = 100 # Hz
kdt = 1 / kalmanFrequency
Ni = (int) (tFinal - tInitial) * kalmanFrequency
print(Ni)
#------------------------- Setup -----------------------#

# Setting up time vector and initial conditions
t, dt = np.linspace(0,tFinal,Nsteps, retstep=True)
x = np.empty((4,t.size))
xplus = np.empty((2,Ni))
z = np.empty((t.size))
w = np.empty((t.size))
P = np.empty((2,2,t.size))
x[:,0] = np.array([x0, v0, theta0, w0]).T
xplus[:,0] = np.array([theta0, w0]).T
P[:,:,0] = np.array([[0,0], [0,0]])
w[0] = w0

# Normal Random number generator
sigma_v_theta = .1*2*math.pi/360 # Measurement noise
sigma_w_theta = .4*2*math.pi/360 # Process noise
sigma_w_omega = .4*2*math.pi/360 # Proces noise
rand_v = np.random.normal(0, sigma_v_theta, t.size)
rand_w_theta = np.random.normal(0, sigma_w_theta, t.size)
rand_w_omega = np.random.normal(0, sigma_w_omega, t.size)
Q = np.array([[sigma_w_theta**2, 0],[0, sigma_w_omega**2]])
R = sigma_v_theta**2

#------------------- Simulation Loop -------------------#

lastTime = 0;
# Looping over time vector and Simulating Dynamics
u = 0
i = 1
tkalman = np.empty(Ni)
tkalman[0] = 0
Pi = np.array([[0,0], [0,0]])

for k, _ in enumerate(t):
	z[k] = x[2,k] + rand_v[k]
	deltaT = t[k] - lastTime
	if deltaT >= kdt:
		xplus[:,i], Pi = kalmanFilter(z[k], u, xplus[:,i-1], Pi, deltaT, Q, R)
		tkalman[i] = t[k]
		lastTime = t[k]
		i = i + 1
	# u[k] = LQR(K, x[k,:])
	if k != t.size - 1:
		x[:,k+1] = rk4(x[:,k], xdot, u, dt)
	# if k == t.size - 2:
	# 	u[k+1] = LQR(K, x[k+1,:])
	# 	break

# for k, _ in enumerate(t):
# 	z[k] = x[2,k] + rand_v[k]
# 	deltaT = t[k] - lastTime
# 	if k != 0 and k != t.size and deltaT >= kdt:
# 		xplus[:,k], P[:,:,k] = kalmanFilter(z[k], u, xplus[:,k-1], P[:,:,k-1], dt, Q, R)
# 	# u[k] = LQR(K, x[k,:])
# 	if k != t.size - 1:
# 		x[:,k+1] = rk4(x[:,k], xdot, u, dt)
# 	# if k == t.size - 2:
# 	# 	u[k+1] = LQR(K, x[k+1,:])
# 	# 	break


#----------------------- Plotting ----------------------#


# plt.figure(1)

# plt.subplot(321)
# plt.plot(t,x[:,0],'r-',linewidth=1)
# plt.ylabel('x')

# plt.subplot(322)
# plt.plot(t,x[:,1],'r-',linewidth=1)
# plt.ylabel('v')

# plt.subplot(323)
# plt.plot(t,x[:,2]*180/math.pi,'r-',linewidth=1)
# plt.ylabel('theta(degrees)')

# plt.subplot(324)
# plt.plot(t,x[:,3],'r-',linewidth=1)
# plt.ylabel('w')

# plt.subplot(325)
# plt.plot(t,u,'r-',linewidth=1)
# plt.ylabel('u')

# plt.subplot(326)
# plt.plot(t,z,'r-',linewidth=1)
# plt.ylabel('z')

plt.figure(1)

# plt.plot(t,x[:,2],'r-',linewidth=3)
plt.plot(t,x[2,:]*180/math.pi,'r-',linewidth=4)
plt.plot(tkalman,xplus[0,:]*180/math.pi, 'g-', linewidth=3)
#plt.plot(t,w, 'b-', linewidth=3)

plt.show()
