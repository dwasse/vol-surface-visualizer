from flask import Flask
from flask import jsonify
from flask_api import status
from flask import render_template
from db import DatabaseController


SUPPORTED_SYMBOLS = ['BTCUSD', 'ETHUSD']


db = DatabaseController()
app = Flask(__name__)


@app.route('/')
def home():
    print("LOAD HOME")
    return render_template('home.html')

@app.route('/<symbol>')
def surface(symbol):
    print("LOAD VOL SURFACE WITH SYMBOL %s " % symbol)
    return render_template('surface.html', symbol=symbol)


@app.route('/api/vol_data/<symbol>', methods=['GET'])
def vol_data(symbol):
    print("GET VOL DATA FOR %s" % symbol)
    if symbol not in SUPPORTED_SYMBOLS:
        print("Got unsupported symbol: %s" % symbol)
        return status.HTTP_404
    query = '''
        SELECT symbol, strike, expiry, vol, delta, gamma, theta, vega 
        FROM contract_summaries 
        WHERE sequence_number = 
            (
                SELECT MAX(sequence_number) 
                FROM contract_summaries
                WHERE underlying_symbol = '%s'
            )
        AND underlying_symbol = '%s';
    ''' % (symbol, symbol)
    print("Query: " + query)
    snapshot=db.execute(query).fetchall()
    print("Got snapshot: %s" % str(snapshot))
    if snapshot is not None:
        return jsonify({'data': snapshot})
    return status.HTTP_404

if __name__ == "__main__":
    app.run(debug=True)