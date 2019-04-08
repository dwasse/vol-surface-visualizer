import datetime
import pytz
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
        self.time = pytz.timezone('UTC').localize(datetime.datetime.now())
        self.options = {
            'call': {},
            'put': {}
        }
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
        self.underlying_price = self.get_mid_market(self.client.getorderbook(self.underlying_exchange_symbol))
        return self.underlying_price

    def get_mid_market(self, orderbook):
        return (orderbook['bids'][0]['price'] + orderbook['asks'][0]['price']) / 2

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

    def iterate_options(self):
        for option_type in self.options:
            for expiry in self.options[option_type]:
                for strike in self.options[option_type][expiry]:
                    yield self.options[option_type][expiry][strike]

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

    def calc_deribit_implied_vols(self, max_market_width=20):
        for option in self.iterate_options():
            orderbook = self.client.getorderbook(instrument=option.exchange_symbol)
            if len(orderbook['bids']) and len(orderbook['asks']):
                best_bid = orderbook['bids'][0]['price']
                best_ask = orderbook['asks'][0]['price']
                mid_market = (best_bid + best_ask) / 2
                market_width = (((best_ask - mid_market) / mid_market) - 1) * 100
                if market_width < max_market_width:
                    option.set_mid_market(mid_market)
                    option.calc_implied_vol(option.mid_market)
                    print("Calculated IV for " + str(option) + ": " + str(option.vol))
                else:
                    print("No liquid market for " + str(option) + ", market is " + str(market_width) + " percent wide")
            else:
                print("No market for " + str(option))

    def update_underlying_price(self, underlying_price):
        self.underlying_price = underlying_price
        for option in self.iterate_options():
            option.set_underlying_price(self.underlying_price)
            option.calc_greeks()

    def load_historical_trades(self, pair=None):
        for option in self.iterate_options():
            option.historical_trades = self.client.getlasttrades(instrument=option.exchange_symbol, count=100000)
            print("Loaded " + str(len(option.historical_trades)) + " trades for " + option.exchange_symbol)
