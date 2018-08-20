# pylint: disable-all
import numpy as np
import math

# Physical Parameters
g = 9810 # mm/s^2
Le = 197.21

# PID Constants
Kp = -10000
Kd = -10
Ki = -10

# Polynomial Coefficients
p = np.empty(4)
p[0] = 1
p[1] = -Kd/Le
p[2] = -(g + Kp)/Le
p[3] = -Ki/Le

# Finding Roots
r = np.roots(p)
print(r)