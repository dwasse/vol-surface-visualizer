from httpServer import SimpleHTTPRequestHandler, HTTPServer
from cryptopt.theoEngine import TheoEngine
import config
import time
import datetime
import json
import urllib
import ast
from threading import Thread
import os

data_path = os.getcwd() + config.delimiter + 'optionData' + config.delimiter


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
                    if len(value_split_2) >=1:
                        value = value_split_2[0]
                if key and value:
                    data[key] = value
            except Exception as e:
                print('error decoding data: ' + str(e))
    
        self.process_data(data)

    def do_GET(self):
        f = self.send_head()
        if f:
            try:
                self.copyfile(f, self.wfile)
            finally:
                f.close()

    def process_data(self, data):
        print("Processing data: " + json.dumps(data))
        if data['action'] == 'getOptionData':
            raw_option_data = load_last_data()
            response_data = {
                'status': 'SUCCESS',
                'data': raw_option_data
            }
            self.send_post_response(response_data)
            print("Sent response with data: " + json.dumps(response_data))

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


def run_server(server_class=HTTPServer, handler_class=Server, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print('Server running at localhost:' + str(port) + '...')
    httpd.serve_forever()


def save_data(theo_engine):
    today = datetime.datetime.today().strftime('%Y-%m-%d')
    utc_timestamp = str(datetime.datetime.utcnow())
    for option in theo_engine.iterate_options():
        option_name = str(int(option.strike)) + "_" + option.option_type
        expiry = str(option.expiry)[:10]
        print("Saving data for option: " + option_name + " with expiry: " + expiry)
        full_data_path = data_path + theo_engine.underlying_pair.replace('/', '-') \
            + config.delimiter + today + config.delimiter + expiry + config.delimiter
        if not os.path.exists(full_data_path):
            print("Creating directory: " + full_data_path)
            os.makedirs(full_data_path)
        savable_data = {
            'timestamp': utc_timestamp,
            'expiry': expiry,
            'type': option.option_type,
            'strike': str(option.strike),
            'delta': str(option.delta),
            'gamma': str(option.gamma),
            'theta': str(option.theta),
            'wvega': str(option.wvega),
            'vega': str(option.vega),
            'vol': str(option.vol)
        }
        with open(full_data_path + option_name + ".json", 'a') as outfile:
            outfile.write(str(savable_data) + ', ')


def theo_engine_runnable(theo_engine):
    while True:
        time.sleep(config.data_pull_freq)
        pull_and_save(theo_engine)


def pull_and_save(theo_engine):
    print("Building options...")
    theo_engine.build_deribit_options()
    print("Calculating vols...")
    theo_engine.calc_deribit_implied_vols()
    print("Calculating greeks...")
    theo_engine.calc_all_greeks()
    print("Saving data...")
    save_data(theo_engine)


def get_immediate_subdirectories(a_dir):
    return [name for name in os.listdir(a_dir)
            if os.path.isdir(os.path.join(a_dir, name))]


def load_last_data():
    options = []
    pairs = get_immediate_subdirectories(data_path)
    for pair in pairs:
        dates = get_immediate_subdirectories(data_path + pair)
        print("dates: " + str(dates))
        date = str(dates[-1])
        print("date: " + str(date) + ", pair: " + pair)
        expirys = get_immediate_subdirectories(data_path + pair + config.delimiter + date)
        print("expirys: " + str(expirys))
        for expiry in expirys:
            file_path = data_path + pair + config.delimiter + date + config.delimiter + expiry
            print("file path: " + file_path)
            files = [f for f in os.listdir(file_path) if os.path.isfile(os.path.join(file_path, f))]
            print("files: " + str(files))
            for file in files:
                with open(file_path + config.delimiter + file, 'r') as data_file:
                    options.append(ast.literal_eval(data_file.read())[-1])
    return options


pair = config.pair
theo_engine = TheoEngine(pair)
raw_option_data = []
if config.load_data:
    raw_option_data = load_last_data()
    print("Loaded raw option data: " + json.dumps(raw_option_data))
else:
    pull_and_save(theo_engine)
theo_engine_thread = Thread(target=theo_engine_runnable, kwargs={'theo_engine': theo_engine})
theo_engine_thread.start()

print("Running server...")
run_server()
