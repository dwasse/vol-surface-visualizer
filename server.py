from httpServer import SimpleHTTPRequestHandler, HTTPServer
from cryptopt.theoEngine import TheoEngine
from threading import Thread
from volWebsocket import VolWebsocket
from autobahn.twisted.websocket import WebSocketServerFactory
from twisted.internet import reactor
from cryptopt.deribitWebsocket import DeribitWebsocket
from databaseController import DatabaseController
import config
import logging
import time
import datetime
import json
import urllib
import ast
import os
import sys
import traceback


def flush_logs():
    with open(config.log_file, 'w'):
        pass


def log_flush_runnable():
    while True:
        time.sleep(3600 * 12)
        flush_logs()


class Server(SimpleHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')
        fields = urllib.parse.parse_qs(post_data)
        raw_messages = str(fields[' name']).split("'")
        data = {}
        for raw_message in raw_messages:
            try:
                key = ''
                value = ''
                key_split = raw_message.split('"')
                if len(key_split) >= 2:
                    key = key_split[1]
                value_split_1 = raw_message.split("\\n")
                if len(value_split_1) >= 3:
                    value_split_2 = value_split_1[2].split('\\r')
                    if len(value_split_2) >= 1:
                        value = value_split_2[0]
                if key and value:
                    data[key] = value
            except Exception as e:
                print('Error decoding data: ' + str(e))
        self.process_data(data)

    def do_GET(self):
        print("Doing GET...")
        f = self.send_head()
        if f:
            try:
                print("Copying file...")
                self.copyfile(f, self.wfile)
                print("Copied file")
            finally:
                f.close()
                print("Closed connection")

    def process_data(self, data):
        logging.info("Processing data: " + json.dumps(data))
        if data['action'] == 'getOptionData':
            pair = data['pair']
            response_data = {
                'status': 'SUCCESS',
                'data': compress_data(load_last_data(theo_engines[pair]))
            }
            self.send_post_response(response_data)
            logging.info("Sent response with data: " +
                         json.dumps(response_data))

    def send_post_response(self, response_data):
        self.send_response(200)
        self.send_header(b"Content-type", b"text")
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def send_failure(self, reason):
        print(reason)
        response_data = {
            'status': 'FAILURE',
            'reason': reason
        }
        self.send_post_response(response_data)


def run_server(server_class=HTTPServer, handler_class=Server, port=config.port):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    msg = 'Server running on port ' + str(port) + '...'
    print(msg)
    logging.info(msg)
    httpd.serve_forever()


def save_data(pair):
    global theo_engines
    today = datetime.datetime.today().strftime('%Y-%m-%d')
    utc_timestamp = str(datetime.datetime.utcnow())
    for option in theo_engines[pair].iterate_options():
        option_name = str(int(option.strike)) + "_" + option.option_type
        expiry = str(option.expiry)[:10]
        print("Saving data for option: " +
              option_name + " with expiry: " + expiry)
        full_data_path = config.data_path + theo_engines[pair].underlying_pair.replace('/', '-') \
            + config.delimiter + today + config.delimiter + expiry + config.delimiter
        temp_data_path = config.data_path + theo_engines[pair].underlying_pair.replace('/', '-') \
            + config.delimiter + "currentData" + config.delimiter + expiry + config.delimiter
        if not os.path.exists(full_data_path):
            print("Creating directory: " + full_data_path)
            os.makedirs(full_data_path)
        if not os.path.exists(temp_data_path):
            print("Creating directory: " + temp_data_path)
            os.makedirs(temp_data_path)
        savable_data = option.get_metadata(utc_timestamp)
        with open(full_data_path + option_name + ".json", 'a') as outfile:
            outfile.write(str(savable_data) + ', ')
        with open(temp_data_path + option_name + ".json", 'w+') as outfile:
            outfile.write(str(savable_data) + ', ')


def load_last_data(theo_engine):
    option_symbols = theo_engine.get_exchange_symbols()
    data = []
    for symbol in option_symbols:
        data.append(theo_engine.db.get_last_snapshot(symbol)[0])
    return data


def theo_engine_runnable():
    global theo_engines
    global pairs
    while True:
        for pair in pairs:
            time.sleep(config.data_pull_freq)
            theo_engines[pair].get_underlying_price()
            pull_thread = Thread(target=pull_and_save, kwargs={'pair': pair})
            pull_thread.start()


def pull_and_save(pair):
    global theo_engines
    print("Pulling and saving at " + time.ctime())
    try:
        logging.info("Building options...")
        theo_engines[pair].build_deribit_options()
        # For local greek calculation:
        # logging.info("Calculating vols...")
        # theo_engines[pair].calc_deribit_implied_vols()
        # logging.info("Calculating greeks...")
        # theo_engines[pair].calc_all_greeks()
        logging.info("Saving data...")
        theo_engines[pair].persist_orderbooks()
    except Exception as e:
        logging.error("Exception pulling and saving data: " + str(e))
        type_, value_, traceback_ = sys.exc_info()
        logging.error('Type: ' + str(type_))
        logging.error('Value: ' + str(value_))
        logging.error('Traceback: ' + str(traceback.format_exc()))


def compress_data(data):
    compressed_data = []
    for entry in data:
        compressed_entry = {}
        for element in entry:
            entry[element] = str(entry[element])
            if entry[element].replace('.', '', 1).isdigit() or 'e-' in entry[element]:
                compressed_entry[element] = round(
                    float(entry[element]), config.num_decimals)
            else:
                compressed_entry[element] = entry[element]
        compressed_data.append(compressed_entry)
    return compressed_data


db = DatabaseController()
pairs = config.pairs
theo_engines = {}
theo_engine_threads = {}

msg = "Running server..."
print(msg)
logging.info(msg)
server_thread = Thread(target=run_server)
server_thread.start()

for pair in pairs:
    theo_engines[pair] = TheoEngine(pair, db)
    raw_option_data = []
    if config.load_data:
        theo_engines[pair].build_deribit_options()
        data = load_last_data(theo_engines[pair])
    else:
        msg = "Pulling data from API and saving..."
        print(msg)
        logging.info(msg)
        pull_and_save(pair)

theo_engine_thread = Thread(target=theo_engine_runnable)
theo_engine_thread.start()

log_flush_thread = Thread(target=log_flush_runnable)
log_flush_thread.start()
