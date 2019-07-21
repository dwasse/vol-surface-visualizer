import datetime
import pytz
import logging
import ast
import cryptopt.utils as utils
from .option import Option
from .deribitREST import DeribitREST


class TheoEngine:
    def __init__(self, underlying_pair,
                 underlying_price=None,
                 expirations=[],
                 strikes={},
                 atm_volatility=0.5,
                 interest_rate=0):
        self.underlying_pair = underlying_pair
        self.underlying_price = underlying_price
        self.expirations = expirations
        self.strikes = {e: strikes for e in self.expirations}
        self.atm_volatility = atm_volatility
        self.interest_rate = interest_rate
        self.currency = self.underlying_pair.split('/')[0]
        self.time = utils.get_current_time()
        self.options = {
            'call': {},
            'put': {}
        }
        self.options_by_name = {}
        self.underlying_exchange_symbol = self.get_exchange_symbol(pair=self.underlying_pair)
        self.client = None
        if underlying_price is None:
            self.setup_client()
            self.get_underlying_price()

    def setup_client(self):
        self.client = DeribitREST()

    def get_atm_option(self, expiry):
        atm_option = None
        best_delta_diff = 1
        for option in self.iterate_options():
            if option.expiry == expiry:
                if option.delta is None:
                    print("No delta found for " + str(option))
                    continue
                delta_diff = abs(abs(option.delta) - .5)
                if atm_option is None or delta_diff < best_delta_diff:
                    best_delta_diff = delta_diff
                    atm_option = option
        return atm_option

    def get_exchange_symbol(self, pair):
        if pair == "BTC/USD":
            return "BTC-PERPETUAL"
        if pair == "ETH/USD":
            return "ETH-PERPETUAL"
        return None

    def get_underlying_price(self):
        orderbook = self.client.getorderbook(self.underlying_exchange_symbol)
        self.underlying_price = (orderbook['bids'][0]['price'] + orderbook['asks'][0]['price']) / 2
        for option in self.iterate_options():
            option.set_underlying_price(self.underlying_price)
        return self.underlying_price

    def get_option(self, option_name):
        if option_name in self.options_by_name:
            return self.options_by_name[option_name]
        return None

    def build_options(self):
        if self.strikes is not None and self.expirations is not None:
            for expiry in self.expirations:
                for option_type in ['call', 'put']:
                    self.options[option_type][expiry] = {}
                for strike in self.strikes[expiry]:
                    for option_type in ['call', 'put']:
                        option = Option(
                            underlying_pair=self.underlying_pair,
                            option_type=option_type,
                            strike=strike,
                            expiry=expiry,
                            interest_rate=0,
                            volatility=self.atm_volatility,
                            underlying_price=self.underlying_price,
                            time=self.time
                        )
                        option.calc_greeks()
                        self.options[option_type][expiry][strike] = option
                        self.options_by_name[option.exchange_symbol] = option

    def parse_option_metadata(self, option_metadata):
        for metadata in option_metadata:
            expiry = metadata['expiry']
            [year, month, day] = expiry.split('-')
            expiry = datetime.datetime(year=int(year), month=int(month), day=int(day), tzinfo=pytz.UTC)
            option_type = metadata['type']
            strike = int(float(metadata['strike']))
            option = Option(underlying_pair=self.underlying_pair,
                            option_type=option_type,
                            strike=strike,
                            expiry=expiry
                            )
            option.delta = float(metadata['delta'])
            option.gamma = float(metadata['gamma'])
            option.theta = float(metadata['theta'])
            option.wvega = float(metadata['wvega'])
            option.vega = float(metadata['vega'])
            option.vol = float(metadata['vol'])
            if 'best_bid' in metadata:
                option.best_bid = ast.literal_eval(metadata['best_bid'])
            if 'best_ask' in metadata:
                option.best_ask = ast.literal_eval(metadata['best_ask'])
            if 'exchange_symbol' in metadata:
                option.exchange_symbol = metadata['exchange_symbol']
            if option_type not in self.options:
                self.options[option_type] = {}
            if expiry not in self.options[option_type]:
                self.options[option_type][expiry] = {}
            self.options[option_type][expiry][strike] = option
            self.options_by_name[option.exchange_symbol] = option

    def iterate_options(self):
        expirys_to_remove = []
        for option_type in self.options:
            for expiry in self.options[option_type]:
                if expiry > utils.get_current_time():
                    for strike in self.options[option_type][expiry]:
                        yield self.options[option_type][expiry][strike]
                else:
                    logging.info("Expiry to remove: " + str(expiry))
                    expirys_to_remove.append(expiry)
        if expirys_to_remove:
            for option_type in self.options:
                self.options[option_type] = {k: v for k, v in self.options[option_type].items()
                                             if k not in expirys_to_remove}
                logging.info("Expirys after removal: " + str(self.options[option_type]))

    def calc_all_greeks(self):
        for option in self.iterate_options():
            option.calc_greeks()
        for option_type in self.options:
            for expiry in self.options[option_type]:
                atm_vega = self.get_atm_option(expiry).vega
                for strike in self.options[option_type][expiry]:
                    option = self.options[option_type][expiry][strike]
                    option.calc_wvega(atm_vega)

    def build_deribit_options(self):
        if self.client is None:
            self.setup_client()
        instruments = [i for i in self.client.getinstruments() if i['baseCurrency'] == self.currency]
        options = [i for i in instruments if i['kind'] == 'option']
        for option_info in options:
            option_type = option_info['optionType']
            strike = option_info['strike']
            expiry = pytz.timezone('GMT').localize(
                datetime.datetime.strptime(option_info['expiration'], '%Y-%m-%d %H:%M:%S GMT')
            )
            if expiry not in self.expirations:
                self.expirations.append(expiry)
            if expiry not in self.strikes:
                self.strikes[expiry] = []
            if strike not in self.strikes[expiry]:
                self.strikes[expiry].append(strike)
            option = Option(
                underlying_pair=self.underlying_pair,
                option_type=option_type,
                strike=strike,
                expiry=expiry,
                interest_rate=0,
                volatility=self.atm_volatility,
                underlying_price=self.underlying_price,
                time=self.time,
                exchange_symbol=option_info['instrumentName']
            )
            if expiry in self.options[option_type]:
                self.options[option_type][expiry][strike] = option
            else:
                self.options[option_type][expiry] = {strike: option}
            self.options_by_name[option.exchange_symbol] = option
            logging.info("Added option to options by name: " + option.exchange_symbol)

    def calc_deribit_implied_vols(self, max_market_width=20):
        for option in self.iterate_options():
            orderbook = self.client.getorderbook(instrument=option.exchange_symbol)
            if len(orderbook['bids']) and len(orderbook['asks']):
                option.best_bid = orderbook['bids'][0]['price']
                option.best_ask = orderbook['asks'][0]['price']
                msg = "Set best market for option: " + option.exchange_symbol \
                    + ": bid: " + str(option.best_bid) + ", ask: " + str(option.best_ask)
                print(msg)
                logging.info(msg)
                option.mid_market = (option.best_bid + option.best_ask) / 2
                market_width = (((option.best_ask - option.mid_market) / option.mid_market) - 1) * 100
                if market_width < max_market_width:
                    option.set_mid_market(option.mid_market)
                    option.calc_implied_vol(option.mid_market)
                else:
                    msg = "No liquid market for " + str(option) + ", market is " + str(market_width) + " percent wide"
                    print(msg)
                    logging.info(msg)
            else:
                msg = "No market for " + option.exchange_symbol
                print(msg)
                logging.info(msg)

    def update_underlying_price(self, underlying_price):
        self.underlying_price = underlying_price
        for option in self.iterate_options():
            option.set_underlying_price(self.underlying_price)
            option.calc_greeks()

    def load_historical_trades(self, pair=None):
        for option in self.iterate_options():
            option.historical_trades = self.client.getlasttrades(instrument=option.exchange_symbol, count=100000)
            print("Loaded " + str(len(option.historical_trades)) + " trades for " + option.exchange_symbol)
