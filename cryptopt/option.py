import datetime
import math
import pytz
import logging
import cryptopt.utils as utils
from scipy.stats import norm


day = 86400


class Option:
    def __init__(self,
                 underlying_pair,
                 option_type,
                 strike,
                 expiry,
                 interest_rate=0,
                 volatility=None,
                 underlying_price=None,
                 time=utils.get_current_time(),
                 exchange_symbol=None):
        self.underlying_pair = underlying_pair
        if not option_type == 'call' and not option_type == 'put':
            raise ValueError('Expected "call" or "put", got ' + option_type)
        self.option_type = option_type
        self.strike = strike
        self.expiry = expiry
        self.interest_rate = interest_rate
        if volatility is not None:
            self.vol = volatility
        else:
            self.vol = None
        self.underlying_price = underlying_price
        self.time = time
        self.exchange_symbol = exchange_symbol
        self.time_left = self.get_time_left(self.time)
        self.d1 = None
        self.d2 = None
        self.theo = None
        self.delta = None
        self.gamma = None
        self.theta = None
        self.vega = None
        self.wvega = None
        self.present_value = None
        self.mid_market = None
        self.best_bid = None
        self.best_ask = None

    def __str__(self):
        return self.underlying_pair + " " + str(self.strike) + " " + self.option_type + " with expiry " + str(self.expiry)

    def get_time_left(self, current_datetime=utils.get_current_time()):
        return (self.expiry - current_datetime).total_seconds() / (day * 365)

    def set_underlying_price(self, underlying_price):
        self.underlying_price = underlying_price

    def get_metadata(self, timestamp=None):
        if timestamp is None:
            timestamp = str(utils.get_current_time())
        return {
            'timestamp': timestamp,
            'expiry': str(self.expiry)[:10],
            'type': self.option_type,
            'strike': str(self.strike),
            'delta': str(self.delta),
            'gamma': str(self.gamma),
            'theta': str(self.theta),
            'wvega': str(self.wvega),
            'vega': str(self.vega),
            'vol': str(self.vol),
            'best_bid': str(self.best_bid),
            'best_ask': str(self.best_ask),
            'exchange_symbol': self.exchange_symbol
        }

    def set_time(self, time):
        self.time = time

    def set_vol(self, vol):
        self.vol = vol

    def set_mid_market(self, mid_market=None):
        if mid_market is not None:
            self.mid_market = mid_market
        else:
            if self.best_bid is not None and self.best_ask is not None:
                self.mid_market = (self.best_bid + self.best_ask) / 2
        logging.info("Set mid market: " + str(self.mid_market))

    def calc_greeks(self, verbose=False):
        self.calc_theo()
        self.calc_delta()
        self.calc_gamma()
        self.calc_theta()
        self.calc_vega()
        if verbose:
            print("Calculated greeks for " + str(self) + ": delta=" + str(self.delta) + ", gamma=" + str(self.gamma)
                  + ", theta=" + str(self.theta))

    def calc_theo(self, time_left=None, store=True):
        if not time_left:
            time_left = self.time_left
        d1 = (math.log(self.underlying_price / self.strike) + (self.interest_rate + ((self.vol ** 2) / 2.0))
              * time_left) / (self.vol * math.sqrt(time_left))
        d2 = d1 - (self.vol * math.sqrt(time_left))
        present_value = self.strike * math.exp(-self.interest_rate * time_left)
        theo = None
        if self.option_type == "call":
            theo = max((self.underlying_price * norm.cdf(d1)) - (present_value * norm.cdf(d2)), 0)
        elif self.option_type == "put":
            theo = max((norm.cdf(-d2) * present_value) - (norm.cdf(-d1) * self.underlying_price), 0)
        if store:
            self.d1 = d1
            self.d2 = d2
            self.theo = theo
            self.present_value = present_value
        return theo

    def calc_delta(self, underlying_price=None, store=True):
        if underlying_price:
            d1 = (math.log(underlying_price / self.strike) + (self.interest_rate + ((self.vol ** 2) / 2.0))
                  * self.time_left) / (self.vol * math.sqrt(self.time_left))
        else:
            d1 = self.d1
        delta = None
        if self.option_type == 'call':
            delta = norm.cdf(d1)
        elif self.option_type == 'put':
            delta = -norm.cdf(-d1)
        if store:
            self.delta = delta
        return delta

    def calc_gamma(self, underlying_pct_change=.1):
        original_delta = self.calc_delta()
        underlying_change = self.underlying_price * (underlying_pct_change / 100)
        incremented_price = self.underlying_price + underlying_change
        incremented_delta = self.calc_delta(underlying_price=incremented_price, store=False)
        self.gamma = (incremented_delta - original_delta) / underlying_change
        return self.gamma

    def calc_theta(self, time_change=1/365):
        if time_change >= self.time_left:
            time_change = self.time_left / 2
        original_theo = self.calc_theo()
        advanced_time = self.time_left - time_change
        advanced_theo = self.calc_theo(time_left=advanced_time)
        self.theta = -1 * (advanced_theo - original_theo)
        return self.theta

    def calc_vega(self, vol_change=.01):
        original_vol = self.vol
        original_theo = self.theo
        self.vol = original_vol * (1 + vol_change)
        new_theo = self.calc_theo(store=False)
        self.vol = original_vol
        self.vega = new_theo - original_theo
        return self.vega

    # Weighted vega = vega / atm_vega
    def calc_wvega(self, atm_vega):
        self.wvega = self.calc_vega() / atm_vega
        return self.wvega

    # Price in BTC
    def calc_implied_vol(self, btc_price=None, num_iterations=100, accuracy=.05, low_vol=0, high_vol=10):
        if btc_price is None:
            btc_price = self.mid_market
        logging.info("Calculating vol for " + self.exchange_symbol + " with btc price " + str(btc_price)
                     + " and underlying price " + str(self.underlying_price))
        usd_price = btc_price * self.underlying_price
        self.calc_theo()
        for i in range(num_iterations):
            if self.theo > usd_price + accuracy:
                high_vol = self.vol
            elif self.theo < usd_price - accuracy:
                low_vol = self.vol
            else:
                break
            self.vol = low_vol + (high_vol - low_vol) / 2.0
            self.calc_theo()
        return self.vol
