# pylint: disable-all
import numpy as np
from scipy import signal
import matplotlib.pyplot as plt

# Inputs
file = "encoder-data-1"
dataDir = "../raw-data/"
saveDir = "../processed-data/"

# Generating total file names
readFileName = dataDir + file + ".txt"
saveFileName = saveDir + file + ".pdf"

# Getting header info
header_info = [0,0,0,0]
lines_to_read = [0,1,2,3]
with open(readFileName) as fd:
    for n, line in enumerate(fd):
        if n in lines_to_read:
            key = line.split(" ")[0]
            value = line.split(" ")[1]
            header_info[n] = (key, value.rstrip() )
            if n >= lines_to_read[-1]:
            	break

# Read data from text file
data = np.loadtxt(readFileName, skiprows=4)

# Calculating Stats
mu = data.mean()
median = np.median(data)
sigma = data.std()
max_data = np.max(data)
min_data = np.min(data)
n_bins = int(max_data - min_data + 1)

# Setting up plot
fig, ax = plt.subplots()

# Title
plt.title(file + " (" + header_info[0][1] + ")")

# Textbox
textstr = '\n'.join((
	r'$\mathrm{' + header_info[1][0] +'}=%.d$' % (int(header_info[1][1]),),
	r'$\mathrm{' + header_info[2][0] +'}=%.d$' % (int(header_info[2][1]),),
	r'$\mathrm{' + header_info[3][0] +'}=%.d$' % (int(header_info[3][1]),),
	r'$\mathrm{min}=%.d$' % (int(min_data), ),
	r'$\mathrm{max}=%.d$' % (int(max_data), ),
	r'$\mathrm{median}=%.d$' % (int(median), ),
	r'$\mathrm{N}=%.d$' % (int(data.size), ),
	r'$\mathrm{N_{bins}}=%.d$' % (int(n_bins), ),
    r'$\mu=%.2f$' % (mu, ),
    r'$\sigma=%.2f$' % (sigma, )))

# histogram
ax.hist(data, n_bins)

# Adjusting plot to look good
props = dict(boxstyle='round', facecolor='wheat', alpha=0.5)
ax.text(1.05, 0.95, textstr, transform=ax.transAxes, fontsize=14,
        verticalalignment='top', bbox=props)
plt.gcf().subplots_adjust(right=.65)

# Saving File
fig.savefig(saveFileName, bbox_inches='tight')

plt.show()