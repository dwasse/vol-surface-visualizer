from autobahn.twisted.websocket import WebSocketServerProtocol
from twisted.internet import reactor
import json
import logging
import time
import ast


class VolWebsocket(WebSocketServerProtocol):

    connections = list()
    connection_currency_map = {}

    def onConnect(self, request):
        msg = time.ctime() + ": Client connecting: {0}".format(request.peer)
        print(msg)
        logging.info(msg)
        self.connections.append(self)
        self.connection_currency_map[self] = []

    def onOpen(self):
        msg = time.ctime() + ": Vol websocket opened"
        print(msg)
        logging.info(msg)

    def onMessage(self, payload, isBinary):
        if isBinary:
            logging.info(
                "Binary message received: {0} bytes".format(len(payload)))
        else:
            logging.info("Text message received: {0}".format(
                payload.decode('utf8')))
        payload_dict = ast.literal_eval("{0}".format(payload.decode('utf8')))
        print("Received payload dict: " + str(payload_dict))
        if "action" in payload_dict and "currency" in payload_dict:
            if (payload_dict["action"] === "subscribe") {
                self.connection_currency_map[self].append(
                    payload_dict["currency"])
                print("Added currency subscription for " +
                      payload_dict["currency"])
            }

    def onClose(self, wasClean, code, reason):
        msg = time.ctime() + ": Vol websocket closed: {0}".format(reason)
        print(msg)
        logging.info(msg)
        self.connections.remove(self)

    @classmethod
    def option_update(cls, option_data):
        payload = json.dumps(option_data, ensure_ascii=False).encode('utf8')
        msg = time.ctime() + ": Sending option update: " + \
            json.dumps(option_data, ensure_ascii=False)
        print(msg)
        logging.info(msg)
        for c in set(cls.connections):
            for currency in cls.connection_currency_map[c]:
                if currency in option_data["exchange_symbol"]:
                    print("Sending option update for " + currency)
                    reactor.callFromThread(cls.sendMessage, c, payload)
