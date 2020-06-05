import time
from db import DatabaseController
from restClients.deribit import DeribitClient as DeribitREST


INSERT_FREQ = 300


class Collector:
    def __init__(self, exchange, underlying_symbols):
        self.exchange = exchange
        self.underlying_symbols = underlying_symbols
        self.db = DatabaseController()
        self.currencies = []
        for symbol in underlying_symbols:
            if 'ETH' in symbol:
                self.currencies.append('ETH')
            elif 'BTC' in symbol:
                self.currencies.append('BTC')
        if self.exchange == 'deribit':
            self.client = DeribitREST()
        else:
            raise Exception("Exchange %s not recognized" % self.exchange)

    def get_symbols(self):
        symbols = []
        if self.exchange == 'deribit':
            for currency in self.currencies:
                instruments = [i for i in self.client.getinstruments(
                ) if i['baseCurrency'] == currency]
                options = [i for i in instruments if i['kind'] == 'option']
                symbols = [o['instrumentName'] for o in options]
        else:
            raise Exception("Exchange %s not recognized" % self.exchange)
        return symbols

    def process_orderbook(self, symbol):
        if self.exchange == 'deribit':
            orderbook_result = self.client.getorderbook(instrument=symbol)
            self.db.insert_snapshot(orderbook_result)
        else:
            raise Exception("Exchange %s not recognized" % self.exchange)

    def collect(self):
        while True:
            last_insert = time.time()
            symbols = self.get_symbols()
            for symbol in symbols:
                self.process_orderbook(symbol)
            print("Processed %s orderbooks." % str(len(symbols)))
            pause = max((last_insert + INSERT_FREQ) - time.time(), 0)
            time.sleep(pause)


if __name__ == "__main__":
    exchange = 'deribit'
    symbols = ['BTC-PERPETUAL', 'ETH-PERPETUAL']
    collector = Collector(exchange=exchange, underlying_symbols=symbols)
    print("Built collector for %s with symbols: %s" %
          (exchange, str(symbols)))
    print("Collecting data...")
    collector.collect()
