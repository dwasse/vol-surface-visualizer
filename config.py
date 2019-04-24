import os
import logging
import time

log_file = "volSurface.log"
with open(log_file, 'w+') as file:
    pass
logging.basicConfig(filename=log_file, level=logging.DEBUG)
logging.disable(logging.DEBUG)
logging.info("Starting log at " + time.ctime() + "...")

delimiter = '/'
data_path = os.getcwd() + delimiter + 'optionData' + delimiter

pair = "BTC/USD"
data_pull_freq = 60
load_data = True
websockets = True
num_decimals = 3
port = 8000
ip = "127.0.0.1"
websocket_port = 9000
