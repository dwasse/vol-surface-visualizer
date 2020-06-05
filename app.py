from flask import Flask
from flask_api import status
from db import DatabaseController


db = DatabaseController()
app = Flask(__name__)


@app.route('/api/vol_data/<symbol>', methods=['GET'])
def vol_data(symbol):
    print("INSERT VOL DATA FOR %s " % symbol))
    snapshot=db.execute("SELECT * ")
    return status.HTTP_200_OK

def get_last_vol_data(theo_engine):
    option_symbols=theo_engine.get_exchange_symbols()
    data=[]
    for symbol in option_symbols:
        data.append(theo_engine.db.get_last_snapshot(symbol)[0])
    return dat

def process_data(data):
        logging.info("Processing data: " + json.dumps(data))
        if data['action'] == 'getOptionData':
            pair=data['pair']
            response_data={
                'status': 'SUCCESS',
                'data': compress_data(load_last_data(theo_engines[pair]))
            }
            self.send_post_response(response_data)
            logging.info("Sent response with data: " +
                         json.dumps(response_data))
        

