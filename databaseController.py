import psycopg2
import config
import logging
import sys
import traceback


def quote(msg):
    return "'" + str(msg) + "'"


def parse_data(cursor):
    desc = cursor.description
    column_names = [col[0] for col in desc]
    data = [dict(zip(column_names, row))
            for row in cursor.fetchall()]
    return data


class DatabaseController:

    def __init__(self,
                 user=config.user,
                 password=config.password,
                 host="127.0.0.1",
                 port="5432",
                 database=config.database,
                 reset=False):
        self.user = user
        self._password = password
        self._host = host
        self._port = port
        self.database = database
        self.connection = None
        self.connect()
        if reset:
            self.reset_db()
        else:
            self.setup_db()

    def connect(self):
        self.connection = psycopg2.connect(
            user=self.user,
            password=self._password,
            host=self._host,
            port=self._port,
            database=self.database)

    def execute(self, query):
        cursor = self.connection.cursor()
        try:
            cursor.execute(query)
            self.connection.commit()
        except Exception as e:
            msg = "Error executing query: "  + query
            logging.error(msg)
            print(msg)
            type_, value_, traceback_ = sys.exc_info()
            logging.error('Type: ' + str(type_))
            logging.error('Value: ' + str(value_))
            logging.error('Traceback: ' + str(traceback.format_exc()))
            self.connection.rollback()
        return cursor

    def insert_json(self, table, json_data):
        data_str = str(json_data).replace("'", '"')
        query = "INSERT INTO " + table + "(Data) VALUES ('" + data_str + "');"
        self.execute(query)
        msg = "Executed query: " + query
        logging.info(msg)
        print(msg)

    def insert_snapshot(self, data, option=None):
        if not data['state'] == 'open':
            raise Exception("Orderbook is not open")
        try:
            if option is None:
                query = '''INSERT INTO OrderbookSnapshots
                (Symbol, Timestamp, Bids, Asks, BidVol, AskVol, Delta, Gamma, Vega, Theta) 
                VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);''' % \
                        (quote(data['instrument']), quote(data['tstamp']), quote(str(data['bids']).replace("'", '"')), quote(str(data['asks']).replace("'", '"')),
                         quote(data['bidIv']), quote(data['askIv']), quote(data['delta']), quote(data['gamma']),
                         quote(data['vega']), quote(data['theta']))
            else:
                vol = (data['askIv'] + data['bidIv']) / 2
                expiry = quote(option.expiry.strftime('%Y-%m-%d %H:%M:%S'))
                query = '''INSERT INTO OrderbookSnapshots
                                (Symbol, Timestamp, Bids, Asks, Vol, BidVol, AskVol, Strike, Expiry, Delta, Gamma, Vega, Theta) 
                                VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);''' % \
                        (quote(data['instrument']), quote(data['tstamp']), quote(str(data['bids']).replace("'", '"')),
                         quote(str(data['asks']).replace("'", '"')), quote(str(vol)),
                         quote(data['bidIv']), quote(data['askIv']), quote(option.strike), expiry,
                         quote(data['delta']), quote(data['gamma']),
                         quote(data['vega']), quote(data['theta']))
            self.execute(query)
        except Exception as e:
            msg = "Error inserting orderbook snapshot: " + str(e) + ", data: " + str(data)
            print(msg)
            logging.error(msg)

    def get_last_snapshot(self, symbol):
        query = '''
        SELECT Symbol, Timestamp, Strike, Expiry, Delta, Vol
        FROM OrderbookSnapshots
        WHERE Symbol='%s'
        ORDER BY ID DESC LIMIT 1
        ''' % symbol
        return parse_data(self.execute(query))

    def setup_db(self):
        query = '''CREATE TABLE IF NOT EXISTS OrderbookSnapshots(
            Id serial PRIMARY KEY,
            Symbol varchar(50) NOT NULL,
            Timestamp bigint NOT NULL,
            Bids jsonb NOT NULL,
            Asks jsonb NOT NULL,
            Vol double precision,
            BidVol double precision,
            AskVol double precision,
            Strike int,
            Expiry timestamp,
            Delta double precision,
            Gamma double precision,
            Vega double precision,
            Theta double precision);'''
        self.execute(query)

    def reset_db(self):
        query = "DROP TABLE IF EXISTS OrderbookSnapshots;"
        self.execute(query)
        self.setup_db()
