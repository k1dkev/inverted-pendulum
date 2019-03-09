# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

#----------------------- Functions ---------------------#



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

H = np.array([1,2])
P = np.array([[3,4], [5,6]])
print("H",H)
print("P",P)
print("HP",H @ P)
print("HPH^T", H @ P @ H.T)
print("PH^T", P @ H.T)




