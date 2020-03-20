# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

#----------------------- Functions ---------------------#

# Swingup control (Note using u = Kw sucks)
def swingup(x):
	k = 0.1
	E = pendE(x)
	Eup = pendE(np.array([0, 0, 0, 0]))
	Kx = 1.0
	Kv = 1.5
	mapped_theta = map_theta(x[2])
	if E <= Eup:
		u = -Amax*sign(x[3]*math.cos(mapped_theta))
	else:
		u = -(Kx*x[0] + Kv*x[1]) # pushes cart towards the center
	return u

# Returns the sign of a value
def sign(val):
	if val < 0: return -1
	if val==0: return 0
	return 1

# Returns the pedulum energy
def pendE(x):
    return 0.5*Ih*x[3]**2 + m*g*L*math.cos(x[2])

# Balance control
def LQR(x):
	Kx = -4.472
	Kv = -5.621
	Kt = -33492.0
	Kw = -4749.0
	mapped_theta = map_theta(x[2])
	u = -(Kx*x[0] + Kv*x[1] + Kt*mapped_theta + Kw*x[3])
	return u

# xdot
def xdot(x, u):
	Xdot = x[1]
	vdot = u
	thetadot = x[3]
	wdot = (m*L*(g*math.sin(x[2]) - u*math.cos(x[2])) - Beta*x[3])/Ih
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

# state estimate
def estimate_state(x):
	return x

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
def canBalance(x):
	mapped_theta = map_theta(x[2])
	bX_OK = abs(x[0]) <= 30
	bV_OK = True
	bTheta_OK = abs(mapped_theta*180/math.pi) <= 2
	bW_OK = abs(x[3]) <= 0.05
	return bX_OK and bV_OK and bTheta_OK and bW_OK

# Can Balance
def cantBalance(x):
	mapped_theta = map_theta(x[2])
	bX_NOK = False
	bV_NOK = False
	bTheta_NOK = abs(mapped_theta*180/math.pi) >= 90
	bW_NOK = False
	return bX_NOK and bV_NOK and bTheta_NOK and bW_NOK

# Control Loop
# def control_loop(x):
# 	if canBalance(x):
# 		u = LQR(x)
# 	else:
# 		u = swingup(x)
# 	if abs(u) > Amax:
# 		u = sign(u)*Amax
# 	return limit_control(x,u)

# Control Loop
def control_loop(x):
	# Note the whole point of this try and except is so this fcn can have the equivalent of static variables
	try:
		if canBalance(x):
			control_loop.bCanBalance = True
		elif cantBalance(x):
			control_loop.bCanBalance = False
		if control_loop.bCanBalance:
			u = LQR(x)
		else:
			u = swingup(x)
		if abs(u) > Amax:
			u = sign(u)*Amax
		return limit_control(x,u)
	except AttributeError:
		control_loop.bCanBalance = False
		return 0

# Limit Control function
def limit_control(x,u):
	if abs(u) > Amax:
		u = sign(u)*Amax
	return track_safety(x,u)

# Track safety function
def track_safety(x,u):
	# Note the whole point of this try and except is so this fcn can have the equivalent of static variables
	try:
		x_max = x[0] + 0.5*sign(x[1])*x[1]**2/Amax
		if not track_safety.bPreventCrash and ((x_max >= (Lt - x_safe)) or (x_max <= (-Lt + x_safe))):
			track_safety.bPreventCrash = True
			track_safety.signOfV = sign(x[1])
		if track_safety.bPreventCrash and sign(x[1]) != track_safety.signOfV and (x_max <= (Lt - x_safe)) and (x_max >= (-Lt + x_safe)):
			track_safety.bPreventCrash = False
		if track_safety.bPreventCrash:
			return -track_safety.signOfV*Amax
		else:
			return u
	except AttributeError:
		track_safety.bPreventCrash = False
		track_safety.signOfV = 0
		return 0

# Map theta from [-inf,inf] -> [-180,180]
def map_theta(theta):
	if theta < 0:
		mapped_theta = -((-theta) % (2*math.pi)) + 2*math.pi
	else:
		mapped_theta = theta % (2*math.pi)
	if mapped_theta > math.pi:
		mapped_theta = mapped_theta - (2*math.pi)
	return mapped_theta

def norm_theta(theta):
	if theta < 0:
		normed_theta = -((-theta) % (2*math.pi)) + 2*math.pi
	else:
		normed_theta = theta % (2*math.pi)
	return normed_theta

#------------------------- Inputs ----------------------#

# Physical Parameters
g = 9810 # mm/s^2
Is = 0.11 # Moment of Inertia of the pendulum shaft
Ig = 716.7 # Moment of Inertia of pendulum about CoM
L = 144.4 # hinge to CoM length
Lt = 250 # Half the track length
x_safe = 10 # Safety margin for keeping x within the track length
m = .094 #kg
Ih = Is + Ig + m*L**2
#Beta = 8 # Damping
Beta = 700 # Damping
Amax = 1000 # mm/s^2 Max acceleration
EnergyUp = pendE(np.array([0, 0, 0, 0]))

# Initial Conditions
x0 = 0
v0 = 0
theta0 = (math.pi/180)*180.0 # Offset in degrees
w0 = 0

# Time and frequencies
timeFinal = 35 # sec
dt = 0.00001 # sec
kalmanFrequency = 1000 # Hz
kdt = 1 / kalmanFrequency

# What type of estimate to use
bUseKalmanFeedback = False
bUsePerfectFeedback = True
bUseBasicEstimate = False

#------------------------- Initialization of vectors -----------------------#

# Setting up time vector and initial conditions
N = math.ceil(timeFinal / dt)
Nk = math.floor(timeFinal * kalmanFrequency) - 1
t = np.empty(N)
x = np.empty((4,N))
z = np.empty(N)
normed_theta = np.empty(N)

u = np.empty(Nk)
x_est = np.empty((4,Nk))
# w_basic = np.empty(Nk)
# z_meas = np.empty(Nk)
# P = np.empty((2,2,Nk))
one_array = np.ones(Nk)
tk = np.empty(Nk)
can_balance = np.empty(Nk)
pend_energy = np.empty(Nk)

x[:,0] = np.array([x0, v0, theta0, w0]).T
x_est[:,0] = np.array([x0, v0, theta0, w0]).T
# P[:,:,0] = np.array([[0,0], [0,0]])
# w_basic[0] = w0
u[0] = 0
pend_energy[0] = pendE(x_est[:,0])
normed_theta[0] = theta0

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
k=1
for i in range(0,N-1):
	if (math.floor(t[i] / kdt) - k) > 0:
		tk[k] = t[i]
		x_est[:,k] = estimate_state(x[:,i])
		u[k] = control_loop(x_est[:,k])
		can_balance[k] = canBalance(x_est[:,k])
		pend_energy[k] = pendE(x_est[:,k])
		k += 1
	x[:,i+1] = integrate_dynamics(x[:,i], xdot, u[k-1], dt)
	t[i+1] = (i+1)*dt
	normed_theta[i+1] = map_theta(x[2,i+1])

#----------------------- Plotting ----------------------#
# Defining subplots
fig, axs = plt.subplots(3, 2, sharex=True)

# Plotting Angular Position
axs[0, 0].plot(t,normed_theta*180.0/math.pi,'r-',linewidth=1,label = 'Normed')
axs[0, 0].plot(tk,x_est[2,:]*180.0/math.pi, 'g-', linewidth=1, label = 'Actual')
# axs[0, 0].plot(t,z,'r-',linewidth=1,label = 'Measurement')
axs[0, 0].set_title('Angular Position')

# Plotting Angular Velocity
axs[1, 0].plot(t,x[3,:], 'b-', linewidth=1, label = 'Actual')
axs[1, 0].plot(tk,x_est[3,:], 'g-', linewidth=2, label = 'Kalman')
# axs[1, 0].plot(tk,w_basic,'r-',linewidth=1,label = 'Basic derivative')
axs[1, 0].set_title('Angular Velocity')

# Can balance / pend energy
axs[2, 0].plot(tk, pend_energy / EnergyUp, 'r-', linewidth=2, label = 'Energy')
axs[2, 0].plot(tk, can_balance, 'g-', linewidth=2, label = 'Balance?')
axs[2, 0].set_title('Can balance / PendE')

# Plotting Linear Position
axs[0, 1].plot(t, x[0,:], 'g-', linewidth=2, label = 'x')
axs[0, 1].set_title('Linear Position')

# Plotting Linear Velocity
axs[1, 1].plot(t, x[1,:], 'g-', linewidth=2, label = 'v')
axs[1, 1].set_title('Linear Velocity')

# Plotting Control u
axs[2, 1].plot(tk, u, 'g-', linewidth=2, label = 'u')
axs[2, 1].set_title('Control u')

# Legend settings
axs[0, 0].legend(frameon=False, loc='upper right', ncol=2)
axs[1, 0].legend(frameon=False, loc='upper right', ncol=2)
axs[2, 0].legend(frameon=False, loc='upper right', ncol=1)
axs[0, 1].legend(frameon=False, loc='upper right', ncol=2)
axs[1, 1].legend(frameon=False, loc='upper right', ncol=2)
axs[2, 1].legend(frameon=False, loc='upper right', ncol=1)

# Show plot
plt.show()