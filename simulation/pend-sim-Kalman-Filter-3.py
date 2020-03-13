# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

#----------------------- Functions ---------------------#

# Swingup control
def swingup(x, v, theta, thetadot):
	k = 0.1
	E = pendE(theta, thetadot)
	Eup = pendE(0, 0)
	Kx = 1.0
	Kv = 1.5
	if E <= 0.99*Eup:
		if abs(x) >= Lt:
			u = -sign(x)*Amax
		else:
			u = Amax*(-sign(thetadot*math.cos(theta)) + k*sign(x)*math.log(1 - abs(x)/Lt))
	else:
		u = -(Kx*x + Kv*v) # pushes cart towards the center
	if abs(u) > Amax:
		u = sign(u)*Amax
	return u

# # Swingup control
# def swingup(x, v, theta, thetadot):
# 	ksu = 600
# 	kcw = 1.37*ksu
# 	Lt = 150
# 	E = pendE(theta, thetadot)
# 	Eup = pendE(0, 0)
# 	Kx = 1.0
# 	Kv = 1.5
# 	if E <= Eup:
# 		if abs(x) >= Lt:
# 			return -sign(x)*ksu
# 		else:
# 			return -ksu*sign(thetadot*math.cos(theta)) + kcw*sign(x)*math.log(1 - abs(x)/Lt)
# 		#return -ksu*sign(thetadot*math.cos(theta))
# 	else:
# 		#return -ksu*sign(thetadot*math.cos(theta))
# 		return -(Kx*x + Kv*v) # pushes cart towards the center

# Returns the sign of a value
def sign(val):
	if val < 0: return -1
	if val==0: return 0
	return 1

# Returns the pedulum energy
def pendE(theta, thetadot):
    return 0.5*Ih*thetadot**2 + m*g*L*math.cos(theta)

# Balance control
def LQR(x, v, theta, thetadot):
	Kx = -4.472
	Kv = -5.621
	Kt = -33492.0
	Kw = -4749.0
	mod_theta = theta % (2 * math.pi)
	u = -(Kx*x + Kv*v + Kt*mod_theta + Kw*thetadot)
	if abs(u) > Amax:
		u = sign(u)*Amax
	return u

# xdot
def xdot(x, u):
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (m*L/Ih)*(g*math.sin(x[2]) - u*math.cos(x[2]) - Beta*x[3])
	return np.transpose(np.array([Xdot, vdot, thetadot, wdot]))

# rk4 updates x
def rk4(x, xdot, u, dt):
	k1 = xdot(x, u)*dt
	k2 = xdot(x + k1/2, u)*dt
	k3 = xdot(x + k2/2, u)*dt
	k4 = xdot(x + k3, u)*dt
	return x + (k1 + 2*k2 + 2*k3 + k4)/6

# integrate dynamics
def integrate_dynamics(x, xdot, u, dt):
	return x + xdot(x,u)*dt

# Kalman Filter
def kalmanFilter(z_kp1, u, xplus_k, Pplus_k, dt, Q, R):
	theta_minus_kp1 = xplus_k[0] + xplus_k[1]*dt
	omega_minus_kp1 = xplus_k[1] + ((g*math.sin(xplus_k[0]) - u*math.cos(xplus_k[0]))/Le -Beta*xplus_k[1])*dt
	xminus_kp1 = np.array([theta_minus_kp1, omega_minus_kp1])
	F_kp1 = np.array([ [1,dt], [(g*math.cos(xminus_kp1[0]) + u*math.sin(xminus_kp1[0]))*dt/Le, 1 - Beta*dt] ])
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

# Can Balance
def canBalance(x, v, theta, thetadot):
	mod_theta = theta % (2 * math.pi)
	return abs(mod_theta*180/math.pi) <= 10

# Control Loop
def control_loop(x, v, theta, thetadot):
	if canBalance(x, v, theta, thetadot):
		return LQR(x, v, theta, thetadot)
	else:
		return swingup(x, v, theta, thetadot)

#------------------------- Inputs ----------------------#

# Physical Parameters
g = 9810 # mm/s^2
Is = 0.11 # Moment of Inertia of the pendulum shaft
Ig = 716.7 # Moment of Inertia of pendulum about CoM
L = 144.4 # hinge to CoM length
Lt = 250 # Half the track length
m = .094 #kg
Ih = Is + Ig + m*L**2
K = 0
Beta = .1 # Damping
Amax = 1000 # mm/s^2 Max acceleration

# Initial Conditions
x0 = 0
v0 = 0
theta0 = (math.pi/180)*.1 # Offset in degrees
w0 = 0

# Time and frequencies
timeFinal = 1 # sec
dt = 0.0001 # sec
kalmanFrequency = 100 # Hz
kdt = 1 / kalmanFrequency

#------------------------- Setup -----------------------#

# Setting up time vector and initial conditions
N = ceil(timeFinal / dt)
Nk = floor(timeFinal * kalmanFrequency)
t = np.empty(N)
x = np.empty((4,N))
z = np.empty(N)
u = np.empty(N)

x_est = np.empty((4,Nk))
w_basic = np.empty(Nk)
z_meas = np.empty(Nk)
P = np.empty((2,2,Nk))

x[:,0] = np.array([x0, v0, theta0, w0]).T
x_est[:,0] = np.array([x0, v0, theta0, w0]).T
P[:,:,0] = np.array([[0,0], [0,0]])
w_basic[0] = w0
u[0] = 0

bUseKalmanFeedback = False
bUsePerfectFeedback = True
bUseBasicEstimate = False

# # Normal Random number generator
# sigma_v_theta = .1*2*math.pi/360 # Measurement noise
# sigma_w_theta = .1*2*math.pi/360 # Process noise
# sigma_w_omega = .1*2*math.pi/360 # Proces noise
# rand_v = np.random.normal(0, sigma_v_theta, t.size)
# rand_w_theta = np.random.normal(0, sigma_w_theta, t.size)
# rand_w_omega = np.random.normal(0, sigma_w_omega, t.size)
# Q = np.array([[sigma_w_theta**2, 0],[0, sigma_w_omega**2]])
# R = sigma_v_theta**2

#------------------- Simulation Loop -------------------#

# Looping over time vector and Simulating Dynamics
lastTime = 0
i = 1
tkalman = np.empty(Ni)
can_balance = np.empty(Ni)
pend_energy = np.empty(Ni)
tkalman[0] = 0
Pi = np.array([[0,0], [0,0]])

for i in range(1,N):
	u[i] = 0
	def control_loop(x, v, theta, thetadot):
	x[:,i+1] = integrate_dynamics(x[:,i], xdot, u[i], dt)



for k, _ in enumerate(t):
	z[k] = x[2,k] + rand_v[k] # Measurement
	deltaT = t[k] - lastTime  # Checking track up time since last kalman update
	if deltaT >= kdt:
		z_meas[i] = z[k] 
		xplus[:,i], Pi = kalmanFilter(z[k], u[i-1], xplus[:,i-1], Pi, deltaT, Q, R) # Kalman Filter
		if i == 1:
			w_basic[i] = 0
		else:
			w_basic[i] = (z_meas[i] - z_meas[i-1]) / deltaT # Basic angular velocity
		if bUseKalmanFeedback:
			u[i] = control_loop(x[0,k], x[1,k], xplus[0,i], xplus[1,i])
			can_balance[i] = canBalance(x[0,k], x[1,k], xplus[0,i], xplus[1,i])
			pend_energy[i] = pendE(xplus[0,i], xplus[1,i])
		elif bUseBasicEstimate:
			u[i] = control_loop(x[0,k], x[1,k], z[k], w_basic[i])
			can_balance[i] = canBalance(x[0,k], x[1,k], z[k], w_basic[i])
			pend_energy[i] = pendE(z[k], w_basic[i])
		elif bUsePerfectFeedback:
			u[i] = control_loop(x[0,k], x[1,k], x[2,k], x[3,k])
			can_balance[i] = canBalance(x[0,k], x[1,k], x[2,k], x[3,k])
			pend_energy[i] = pendE(x[2,k], x[3,k])
		tkalman[i] = t[k] # Time for kalman filter
		lastTime = t[k]
		i += 1
	if k != t.size - 1:
		if abs(u[i-1]) > Amax:
			u_lim = sign(u[i-1])*Amax
		else:
			u_lim = u[i-1]
		x[:,k+1] = rk4(x[:,k], xdot, u_lim, dt) # System dynamics

#----------------------- Plotting ----------------------#
# Defining subplots
fig, axs = plt.subplots(3, 2, sharex=True)

# Plotting Angular Position
axs[0, 0].plot(t,z,'r-',linewidth=1,label = 'Measurement')
#ax1.plot(t,x[2,:],'r-',linewidth=1,label = 'Actual')
axs[0, 0].plot(tkalman,xplus[0,:], 'g-', linewidth=2, label = 'Kalman')
axs[0, 0].set_title('Angular Position')

# Plotting Angular Velocity
axs[1, 0].plot(tkalman,w_basic,'r-',linewidth=1,label = 'Basic derivative')
#ax2.plot(t,x[3,:],'r-',linewidth=1,label = 'Actual')
axs[1, 0].plot(tkalman,xplus[1,:], 'g-', linewidth=2, label = 'Kalman')
axs[1, 0].set_title('Angular Velocity')

# Plotting Control
axs[2, 0].plot(tkalman,u, 'g-', linewidth=2, label = 'u')
axs[2, 0].set_title('Control u')

# Plotting Linear Position
axs[0, 1].plot(t, x[0,:], 'g-', linewidth=2, label = 'x')
axs[0, 1].set_title('Linear Position')

# Plotting Linear Velocity
axs[1, 1].plot(t, x[1,:], 'g-', linewidth=2, label = 'v')
axs[1, 1].set_title('Linear Velocity')

# Bonus plot
#axs[2, 1].plot(tkalman, pend_energy / pendE(0,0), 'g-', linewidth=2, label = 't')
#axs[2, 1].set_title('Pendulum energy')
axs[2, 1].plot(tkalman, can_balance, 'g-', linewidth=2, label = 't')
axs[2, 1].set_title('Can balance')

# Legend settings
axs[0, 0].legend(frameon=False, loc='upper right', ncol=2)
axs[1, 0].legend(frameon=False, loc='upper right', ncol=2)
axs[2, 0].legend(frameon=False, loc='upper right', ncol=1)
axs[0, 1].legend(frameon=False, loc='upper right', ncol=2)
axs[1, 1].legend(frameon=False, loc='upper right', ncol=2)
axs[2, 1].legend(frameon=False, loc='upper right', ncol=1)

# Show plot
plt.show()