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

# db
user = "user"
password = "password"
database = "volsurface"

pairs = ["BTC/USD", "ETH/USD"]
data_pull_freq = 60
load_data = False 
num_decimals = 3
port = 8000
ip = "127.0.0.1"
