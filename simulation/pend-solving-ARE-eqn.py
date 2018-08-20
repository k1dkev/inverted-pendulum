# pylint: disable-all
import numpy as np
import matplotlib.pyplot as plt
import math
import scipy.linalg

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21 # Effective Pendulum length
Lt = 250 # Half the track length

# LQR Weights
qx = .1
qv = .05
qt = 1
qw = 1
r = .005

# Matrices
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