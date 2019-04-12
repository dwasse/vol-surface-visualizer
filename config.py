import os
import logging
import time

log_file = "volSurface.log"
with open(log_file, 'w+') as file:
    pass
logging.basicConfig(filename=log_file, level=logging.DEBUG)
logging.disable(logging.DEBUG)
logging.info("Starting log at " + time.ctime() + "...")

pair = "BTC/USD"
data_pull_freq = 60
delimiter = '/'
load_data = True
websockets = False
num_decimals = 3
