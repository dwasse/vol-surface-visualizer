import psycopg2
import config
import logging
import sys
import traceback
import os


SETUP_FILE_NAME = 'init.sql'
USER = 'vol_admin'
PASSWORD = 'password'
HOST = 'localhost'
PORT = '5432'
DATABASE = 'vol_surface_visualizer'


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
                 user=USER,
                 password=PASSWORD,
                 host=HOST,
                 port=PORT,
                 database=DATABASE,
                 reset=False):
        self.user = user
        self._password = password
        self._host = host
        self._port = port
        self.database = database
        self.connection = None
        if reset:
            self.reset_db()
        else:
            self.setup_db()
        self.connect()

    def connect(self):
        self.connection = psycopg2.connect(
            user=self.user,
            password=self._password,
            host=self._host,
            port=self._port,
            database=self.database)

    def setup_db(self):
        if sys.platform == 'linux':
            cmd = "sudo -u postgres psql -f %s" % SETUP_FILE_NAME
        elif sys.platform == 'darwin':
            cmd = "psql -f %s postgres" % SETUP_FILE_NAME
        else:
            raise Exception("Unsupported os: %s" % sys.platform)
        os.system(cmd)
        print("Setup db with %s" % SETUP_FILE_NAME)

    def reset_db(self):
        query = "DROP TABLE IF EXISTS contract_summaries;"
        self.execute(query)
        self.setup_db()

    def execute(self, query):
        cursor = self.connection.cursor()
        try:
            cursor.execute(query)
            self.connection.commit()
        except Exception as e:
            msg = "Error executing query: " + query
            logging.error(msg)
            print(msg)
            type_, value_, traceback_ = sys.exc_info()
            logging.error('Type: ' + str(type_))
            logging.error('Value: ' + str(value_))
            logging.error('Traceback: ' + str(traceback.format_exc()))
            self.connection.rollback()
        return cursor

    def insert_snapshot(self, data):
        try:
            query = '''INSERT INTO contract_summaries
            (symbol, timestamp, bid_vol, ask_vol, delta, gamma, vega, theta) 
            VALUES(%s, %s, %s, %s, %s, %s, %s, %s);''' % \
                    (quote(data['instrument']), quote(data['tstamp']),
                        quote(data['bidIv']), quote(data['askIv']), quote(
                            data['delta']), quote(data['gamma']),
                        quote(data['vega']), quote(data['theta']))
            self.execute(query)
        except Exception as e:
            msg = "Error inserting contract summary: " + \
                str(e) + ", data: " + str(data)
            print(msg)
            logging.error(msg)
        try:
            for bid in data['bids']:
                query = '''INSERT INTO order_snapshots
                (symbol, timestamp, price, amount)
                VALUES(%s, %s, %s, %s);''' % (quote(data['instrument']), quote(data['tstamp']), quote(bid['price']), quote(bid['amount']))
            for ask in data['asks']:
                query = '''INSERT INTO order_snapshots
                (symbol, timestamp, price, amount)
                VALUES(%s, %s, %s, %s);''' % (quote(data['instrument']), quote(data['tstamp']), quote(ask['price']), quote(ask['amount']))
        except Exception as e:
            msg = "Error inserting contract summary: " + \
                str(e) + ", data: " + str(data)
            print(msg)
            logging.error(msg)

    def get_last_contract_summary(self, symbol):
        query = '''
        SELECT symbol, strike, expiry, delta, vol
        FROM contract_summaries
        WHERE symbol='%s'
        ORDER BY ID DESC LIMIT 1
        ''' % symbol
        return parse_data(self.execute(query))
