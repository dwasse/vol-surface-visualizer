from httpServer import SimpleHTTPRequestHandler, HTTPServer
from cryptopt.theoEngine import TheoEngine
from threading import Thread
from volWebsocket import VolWebsocket
from autobahn.twisted.websocket import WebSocketServerFactory
from twisted.internet import reactor
from cryptopt.deribitWebsocket import DeribitWebsocket
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


if not os.path.exists(config.data_path):
    print("Creating data directory: " + config.data_path)
    os.makedirs(config.data_path)
    config.load_data = False


class Server(SimpleHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers['Content-Length']) # <--- Gets the size of data
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
        f = self.send_head()
        if f:
            try:
                self.copyfile(f, self.wfile)
            finally:
                f.close()

    def process_data(self, data):
        logging.info("Processing data: " + json.dumps(data))
        if data['action'] == 'getOptionData':
            pair = data['pair']
            response_data = {
                'status': 'SUCCESS',
                'data': compress_data(load_last_data(pair))
            }
            self.send_post_response(response_data)
            logging.info("Sent response with data: " + json.dumps(response_data))

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
        print("Saving data for option: " + option_name + " with expiry: " + expiry)
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


def theo_engine_runnable():
    global theo_engines
    global pairs
    while True:
        for pair in pairs:
            time.sleep(config.data_pull_freq)
            theo_engines[pair].get_underlying_price()
            pull_and_save(pair)


def pull_and_save(pair):
    global theo_engines
    print("Pulling and saving at " + time.ctime())
    try:
        logging.info("Building options...")
        theo_engines[pair].build_deribit_options()
        logging.info("Calculating vols...")
        theo_engines[pair].calc_deribit_implied_vols()
        logging.info("Calculating greeks...")
        theo_engines[pair].calc_all_greeks()
        logging.info("Saving data...")
        save_data(pair)
    except Exception as e:
        logging.error("Exception pulling and saving data: " + str(e))
        type_, value_, traceback_ = sys.exc_info()
        logging.error('Type: ' + str(type_))
        logging.error('Value: ' + str(value_))
        logging.error('Traceback: ' + str(traceback.format_exc()))


def get_immediate_subdirectories(a_dir):
    return [name for name in os.listdir(a_dir)
            if os.path.isdir(os.path.join(a_dir, name))]


def load_last_data(pair_to_load):
    print("Loading last data for " + pair_to_load)
    global theo_engine
    options = []
    pairs = get_immediate_subdirectories(config.data_path)
    print("Loaded subdirectory pairs: " + str(pairs))
    for pair in pairs:
        if pair.replace('-', '/') == pair_to_load:
            print("Found directory for " + pair)
            expirys = get_immediate_subdirectories(config.data_path + pair + config.delimiter + "currentData")
            for expiry in expirys:
                [year, month, day] = expiry.split('-')
                expiry_datetime = datetime.datetime(year=year, month=month, day=day)
                if expiry_datetime > datetime.datetime.now():
                    file_path = config.data_path + pair + config.delimiter + "currentData" + config.delimiter + expiry
                    files = [f for f in os.listdir(file_path) if os.path.isfile(os.path.join(file_path, f))]
                    for file in files:
                        with open(file_path + config.delimiter + file, 'r') as data_file:
                            try:
                                options.append(ast.literal_eval(data_file.read())[-1])
                            except Exception as e:
                                print("Exception loading data for file: " + file + ": " + str(e))
                else:
                    print("Stale expiry: " + str(expiry))
            print("Loaded option data with timestamp: " + str(options[-1]['timestamp']))
    theo_engines[pair_to_load].parse_option_metadata(options)
    msg = "Parsed option metadata for " + pair_to_load
    print(msg)
    logging.info(msg)
    return options


def compress_data(data):
    compressed_data = []
    for entry in data:
        compressed_entry = {}
        for element in entry:
            if entry[element].replace('.', '', 1).isdigit() or 'e-' in entry[element]:
                compressed_entry[element] = round(float(entry[element]), config.num_decimals)
            else:
                compressed_entry[element] = entry[element]
        compressed_data.append(compressed_entry)
    return compressed_data


pairs = config.pairs
theo_engines = {}
theo_engine_threads = {}
for pair in pairs:
    theo_engines[pair] = TheoEngine(pair)
    raw_option_data = []
    if config.load_data:
        raw_option_data = load_last_data(pair)
        msg = "Loaded raw option data for " + pair + ": " + json.dumps(raw_option_data)
        # print(msg)
        logging.info(msg)
    else:
        msg = "Pulling data from API and saving..."
        print(msg)
        logging.info(msg)
        pull_and_save(pair)

theo_engine_thread = Thread(target=theo_engine_runnable)
theo_engine_thread.start()

msg = "Running server..."
print(msg)
logging.info(msg)
server_thread = Thread(target=run_server)
server_thread.start()
