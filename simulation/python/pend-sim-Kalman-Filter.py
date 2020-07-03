# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

#----------------------- Functions ---------------------#

# Returns the sign of a value
def sign(val):
	if val < 0: return -1
	if val==0: return 0
	return 1

# Continous Dynamics
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

# System Specific Discrete Dynamics of just theta and omega
def f(x_km1, u_km1, dt):
	# x = [theta w]^T
	# x_k = f(x_km1, u_km1)
	thetadot = x_km1[1]
	wdot = (m*L*(g*math.sin(x_km1[0]) - u_km1*math.cos(x_km1[0])) - Beta*x_km1[1])/Ih
	xk = x_km1 + np.transpose(np.array([thetadot, wdot]))*dt
	return xk

def Jf(x, u, dt):
	# x = [theta w]^T
	# Jf = F = df/dx
	F11 = 1
	F21 = dt
	F12 = (m*L*dt/Ih)*(g*math.cos(x[0]) + u*math.sin(x[0]))
	F22 = 1 - Beta*dt/Ih
	return np.array([[F11, F21], [F12, F22]])

def h(x):
	# x = [theta w]^T
	# z = h(x)
	return x[0]

def Jh(x):
	# x = [theta w]^T
	# Jh = H = dh/dx
	return np.array([1, 0])

# Extended Kalman Filter
def EKF(x, P, u, f, Jf, Q, z, h, Jh, R, dt):
	# x is the state estimate at the last time step
	# f is the discrete dynamics of the system x_k = f(x_k-1,u_k-1) + w
	# Jf is the Jacbocian of the discrete dynamics Jf = F = df/dx
	# Q is the process noise covariance matrix Q = Cov(w)
	# z is the measurement. Note z = h(x) + v
	# h is the measurement function
	# Jh is the Jacobian of measurement function Jh = H = dh/dx
	# R is the measurement noise covariance matrix R = Cov(v)
	# dt is the time step

	# Predict Step
	x_pre = f(x, u, dt)
	F = Jf(x, u, dt)
	P_pre = F @ P @ F.T + Q

	# Update Step
	H = Jh(x_pre)
	y = z - h(x_pre)
	S = H @ P_pre @ H.T + R
	if S.size == 1:
		K = P_pre @ H.T / S
	else:
		K = P_pre @ H.T @ scipy.linalg.inv(S)
	if y.size == 1:
		x_est = x_pre + K*y
	else:
		x_est = x_pre + K @ y
	I = np.identity(x.size)
	P_est = (I - K @ H) @ P_pre
	P_est = np.absolute(P_est)
	return (x_est, P_est)

# Can Balance
def canBalance(x):
	mapped_theta = map_theta(x[2])
	bX_OK = abs(x[0]) <= 30
	bV_OK = True
	bTheta_OK = abs(mapped_theta*180/math.pi) <= 3
	bW_OK = abs(x[3]) <= 0.05
	return bX_OK and bV_OK and bTheta_OK and bW_OK

# Cant Balance
def cantBalance(x):
	mapped_theta = map_theta(x[2])
	bX_NOK = False
	bV_NOK = False
	bTheta_NOK = abs(mapped_theta*180/math.pi) >= 45
	bW_NOK = False
	return bX_NOK and bV_NOK and bTheta_NOK and bW_NOK

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

# Returns the pedulum energy
def pendE(x):
    return 0.5*Ih*x[3]**2 + m*g*L*math.cos(x[2])

# Swingup control (Note using u = Kw sucks)
def swingup(x):
	try:
		k = 0.1
		E = pendE(x)
		Eup = pendE(np.array([0, 0, 0, 0]))
		Kx = 5
		Kv = 5
		mapped_theta = map_theta(x[2])
		if E/Eup > 1.0:
			swingup.bMaintain = True
		elif E/Eup < 0.8:
			swingup.bMaintain = False
		if swingup.bMaintain:
			if E/Eup < 1.0:
				Eadd = .5*Eup # 1 percent of Eup per second
			else:
				Eadd = 0.0
			u = -Kx*x[0] - Kv*x[1] -(Beta*x[3]+Eadd/x[3])/(m*L*math.cos(mapped_theta))
		else:
			u = -Amax*sign(x[3]*math.cos(mapped_theta))
		return u
	except AttributeError:
		swingup.bMaintain = False
		return 0

# Balance control
def LQR(x):
	Kx = -4.472
	Kv = -5.621
	Kt = -33492.0
	Kw = -4749.0
	mapped_theta = map_theta(x[2])
	u = -(Kx*x[0] + Kv*x[1] + Kt*mapped_theta + Kw*x[3])
	return u

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

# Map theta from [-inf,inf] -> [0,360]
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
Beta = 700 # Damping
Amax = 1000 # mm/s^2 Max acceleration
EnergyUp = pendE(np.array([0, 0, 0, 0]))

# Initial Conditions
x0 = 0
v0 = 0
theta0 = (math.pi/180)*180.0 # Offset in degrees
w0 = 0

# Time and frequencies
timeFinal = 100 # sec
dt = 0.0001 # sec
kalmanFrequency = 1000 # Hz
kdt = 1 / kalmanFrequency

# What type of estimate to use
bUseKalmanFeedback = True
bUsePerfectFeedback = False
bUseProcessNoise = False

#------------------------- Initialization of vectors -----------------------#

# Setting up time vector and initial conditions
N = math.ceil(timeFinal / dt)
Nk = math.floor(timeFinal * kalmanFrequency) - 1
t = np.empty(N)
x = np.empty((4,N))
normed_theta = np.empty(N)

u = np.empty(Nk)
x_est = np.empty((4,Nk))
one_array = np.ones(Nk)
tk = np.empty(Nk)
can_balance = np.empty(Nk)
pend_energy = np.empty(Nk)
z = np.empty(Nk)

x[:,0] = np.array([x0, v0, theta0, w0]).T
x_est[:,0] = np.array([x0, v0, theta0, w0]).T
u[0] = 0
pend_energy[0] = pendE(x_est[:,0])
normed_theta[0] = theta0
z[0] = theta0

# Normal Random number generator
sigma_v_theta = 0.5*math.pi/180 # Measurement noise
sigma_w_theta = .05*math.pi/180 # Process noise
sigma_w_omega = .05*math.pi/180 # Proces noise
rand_v = np.random.normal(0, sigma_v_theta, Nk)
rand_w_theta = np.random.normal(0, sigma_w_theta, N)
rand_w_omega = np.random.normal(0, sigma_w_omega, N)
w = np.empty((4,N))
Q = np.array([[sigma_w_theta**2, 0],[0, sigma_w_omega**2]])
R = np.array([sigma_v_theta**2])
P_est = np.array([[0,0], [0,0]])
x_tw = np.array([theta0, w0]).T

#------------------- Simulation Loop -------------------#

# Looping over time vector and Simulating Dynamics
k=1
for i in range(0,N-1):
	if (math.floor(t[i] / kdt) - k) > 0:
		tk[k] = t[i]
		if bUseKalmanFeedback:
			z[k] = x[2,i] + rand_v[k]
			x_tw, P_est = EKF(x_tw, P_est, u[k-1], f, Jf, Q, z[k], h, Jh, R, kdt)
			x_est[:,k] = np.array([x[0,i], x[1,i], x_tw[0], x_tw[1]]).T
		elif bUsePerfectFeedback:
			x_est[:,k] = x[:,i]
		u[k] = control_loop(x_est[:,k])
		can_balance[k] = canBalance(x_est[:,k])
		pend_energy[k] = pendE(x_est[:,k])
		k += 1
	if bUseProcessNoise:
		w[:,i] = np.array([0, 0, rand_w_theta[i], rand_w_omega[i]]).T
	else:
		w[:,i] = np.array([0, 0, 0, 0]).T
	x[:,i+1] = integrate_dynamics(x[:,i], xdot, u[k-1], dt) + w[:,i]
	t[i+1] = (i+1)*dt
	normed_theta[i+1] = map_theta(x[2,i+1])

#----------------------- Plotting ----------------------#
# Defining subplots
fig, axs = plt.subplots(3, 2, sharex=True)

# Plotting Angular Position
axs[0, 0].plot(t,x[2,:]*180.0/math.pi, 'b-', linewidth=1, label = 'Actual')
axs[0, 0].plot(tk,x_est[2,:]*180.0/math.pi, 'g-', linewidth=1, label = 'Kalman')
axs[0, 0].plot(tk,z*180.0/math.pi,'r-',linewidth=1,label = 'Measurement')
axs[0, 0].set_title('Angular Position')

# Plotting Angular Velocity
axs[1, 0].plot(t,x[3,:], 'b-', linewidth=1, label = 'Actual')
axs[1, 0].plot(tk,x_est[3,:], 'g-', linewidth=2, label = 'Kalman')
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