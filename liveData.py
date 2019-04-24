import config
import logging
import ast
import json
import sys
import os
import traceback
from cryptopt.theoEngine import TheoEngine
from threading import Thread
from volWebsocket import VolWebsocket
from autobahn.twisted.websocket import WebSocketServerFactory
from twisted.internet import reactor
from cryptopt.deribitWebsocket import DeribitWebsocket


def run_websocket():
    global reactor
    reactor.run()


def on_deribit_msg(msg):
    global reactor
    global theo_engine
    logging.info("Processing deribit msg: " + msg)
    msg_data = ast.literal_eval(msg.replace("true", "True").replace("false", "False"))
    try:
        notifications = msg_data['notifications']
        for notif in notifications:
            if notif["success"]:
                logging.info("Processing notif: " + json.dumps(notif))
                result = notif["result"]
                instrument = result["instrument"]
                option = theo_engine.get_option(instrument)
                logging.info("msg instrument: " + instrument + ", theo engine instruments: "
                             + json.dumps(list(theo_engine.options_by_name.keys())))
                if option is not None:
                    logging.info("Got option: " + option.exchange_symbol)
                    bids = result["bids"]
                    asks = result["asks"]
                    for bid in bids:
                        option.best_bid = bid['price']
                        logging.info("Set best bid for " + instrument + ": " + str(option.best_bid))
                    for ask in asks:
                        option = theo_engine.get_option(instrument)
                        option.best_ask = ask['price']
                        logging.info("Set best ask for " + instrument + ": " + str(option.best_ask))
                    option.set_mid_market()
                    vol = option.vol
                    option.calc_implied_vol()
                    logging.info("Updated implied vol for " + instrument + " from " + str(vol) + " to " + str(option.vol))
                    log_msg = "Calling reactor.option_update()"
                    print(log_msg)
                    logging.info(log_msg)
                    VolWebsocket.option_update(option.get_metadata())
    except Exception as e:
        logging.error("Error processing msg: " + str(e))
        type_, value_, traceback_ = sys.exc_info()
        logging.error('Type: ' + str(type_))
        logging.error('Value: ' + str(value_))
        logging.error('Traceback: ' + str(traceback.format_exc()))


def get_immediate_subdirectories(a_dir):
    return [name for name in os.listdir(a_dir)
            if os.path.isdir(os.path.join(a_dir, name))]


def load_last_data():
    global theo_engine
    options = []
    pairs = get_immediate_subdirectories(config.data_path)
    for pair in pairs:
        dates = get_immediate_subdirectories(config.data_path + pair)
        date = str(dates[-1])
        expirys = get_immediate_subdirectories(config.data_path + pair + config.delimiter + date)
        for expiry in expirys:
            file_path = config.data_path + pair + config.delimiter + date + config.delimiter + expiry
            files = [f for f in os.listdir(file_path) if os.path.isfile(os.path.join(file_path, f))]
            for file in files:
                with open(file_path + config.delimiter + file, 'r') as data_file:
                    options.append(ast.literal_eval(data_file.read())[-1])
    theo_engine.parse_option_metadata(options)
    msg = "Parsed option metadata"
    print(msg)
    logging.info(msg)
    return options


if config.load_data and config.websockets:
    pair = config.pair
    theo_engine = TheoEngine(pair)
    raw_option_data = load_last_data()
    msg = "Loaded raw option data: " + json.dumps(raw_option_data)
    # print(msg)
    logging.info(msg)
    theo_engine.get_underlying_price()

    msg = "Connecting to deribit websocket..."
    print(msg)
    logging.info(msg)
    deribit_websocket = DeribitWebsocket(on_message=on_deribit_msg)
    deribit_ws_thread = Thread(target=deribit_websocket.start)
    deribit_ws_thread.start()

    msg = "Running websocket..."
    print(msg)
    logging.info(msg)
    factory = WebSocketServerFactory(u"ws://" + config.ip + ":" + str(config.websocket_port))
    factory.protocol = VolWebsocket
    reactor.listenTCP(9000, factory)
    run_websocket()
else:
    print("Need config.live_data [" + str(config.load_data) + "] and config.websockets ["
          + str(config.websockets) + "] to run live data")
