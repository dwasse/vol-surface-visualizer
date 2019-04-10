from autobahn.twisted.websocket import WebSocketServerProtocol
from twisted.internet import reactor
import json
import logging


class VolWebsocket(WebSocketServerProtocol):

    connections = list()

    def onConnect(self, request):
        print("Client connecting: {0}".format(request.peer))
        self.connections.append(self)

    def onOpen(self):
        print("WebSocket connection open.")

    def onMessage(self, payload, isBinary):
        if isBinary:
            print("Binary message received: {0} bytes".format(len(payload)))
        else:
            print("Text message received: {0}".format(payload.decode('utf8')))

        # echo back message verbatim
        self.sendMessage(payload, isBinary)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {0}".format(reason))
        self.connections.remove(self)

    @classmethod
    def option_update(cls, option_data):
        payload = json.dumps(option_data, ensure_ascii=False).encode('utf8')
        msg = "Sending option update: " + json.dumps(option_data, ensure_ascii=False)
        print(msg)
        logging.info(msg)
        for c in set(cls.connections):
            reactor.callFromThread(cls.sendMessage, c, payload)
