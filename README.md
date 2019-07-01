This repository holds the client and server for the volatility surface visualizer at www.0xhedge.io. Implied volatility is calculated from mid-market Deribit data with naive Black-Scholes and plotted against delta/strike and time to expiration.

## Dependencies

You will need:

  * `python3`
  * `python3-pip`
  * `npm`

To install pypi dependencies, run `pip3 install -r requirements.txt`.

To install npm dependencies, run `npm install`.

## Getting Started

To run the server, do `python3 server.py`.

To run a websocket server for live data support, run `python3 liveData.py` once the server is running.
