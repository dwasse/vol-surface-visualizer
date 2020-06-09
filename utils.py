import datetime


def get_underlying_symbol(symbol):
    if 'BTC' in symbol:
        return 'BTCUSD'
    if 'ETH' in symbol:
        return 'ETHUSD'
    return ''

def get_mid_market(bid, ask):
    return bid + ask / 2

def get_strike(symbol, exchange='deribit'):
    if exchange == 'deribit':
        split = symbol.split('-')
        if len(split) > 2:
            return split[2]
        raise Exception("Cannot get strike from malformed deribit symbol: %s" % symbol)
    raise Exception("Exchange not yet implemented")

def get_expiry(symbol, exchange='deribit'):
    if exchange == 'deribit':
        split = symbol.split('-')
        if len(split) > 1:
            abbr = split[1]
            datetime_obj = datetime.datetime.strptime(abbr, '%d%b%y')
            return int(datetime_obj.replace(tzinfo=datetime.timezone.utc).timestamp() * 1000)
        raise Exception("Cannot get expiry from malformed deribit symbol: %s" % symbol)
    raise Exception("Exchange not yet implemented")
