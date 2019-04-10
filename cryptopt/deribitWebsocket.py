from cryptopt.deribitREST import DeribitREST
import websocket
import json
import apis


class DeribitWebsocket:
    def __init__(self, on_message, currency=["BTC"], instruments=["options"], events=["order_book"], depth=["1"]):
        self.on_message = on_message
        self.client = DeribitREST(apis.key, apis.secret)
        self.currency = currency
        self.instruments = instruments
        self.events = events
        self.depth = depth
        self.ws = None

    # def on_message(self, message):
    #     print(message)

    def on_error(self, error):
        print(error)

    def on_close(self):
        print("### closed ###")

    def on_open(self):
        data = {
            "id": 5533,
            "action": "/api/v1/private/subscribe",
            "arguments": {
                "instrument": self.instruments,
                "event": self.events,
                "depth": self.depth,
                "currency": self.currency
            }
        }
        data['sig'] = self.client.generate_signature(data['action'], data['arguments'])

        self.ws.send(json.dumps(data))

    def start(self):
        websocket.enableTrace(True)
        self.ws = websocket.WebSocketApp("wss://www.deribit.com/ws/api/v1/",
                                  on_error=self.on_error,
                                  on_close=self.on_close)
        self.ws.on_open = self.on_open
        self.ws.on_message = lambda ws, msg: self.on_message(msg)
        self.ws.run_forever()
