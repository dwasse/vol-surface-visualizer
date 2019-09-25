This repository holds the client and server for the volatility surface visualizer at http://0xhedge.io. Implied volatility is calculated from mid-market Deribit data with naive Black-Scholes and plotted against delta/strike and time to expiration.

## What is a volatility surface?

A volatility surface is a 3d plot of option implied volatility as a function of delta (or strike) and time to expiration. This allows us to visualize the market's outlook on volatility. We calculate implied volatility using the Black-Scholes formula, using the mid-market option price from deribit.

## Dependencies

You will need:

  * `python3`
  * `python3-pip`
  * `npm`
  * `postgresql`

On ubuntu, you can install dependencies with:
```
./setup.sh
```
Then, you will need to create the vol surface database:
```
sudo -u postgres psql
> CREATE DATABASE volsurface;
> CREATE USER "user" WITH ENCRYPTED PASSWORD 'password';
> \q
```

## Getting Started

To run the server, do `python3 server.py`.

To run a websocket server for live data support, run `python3 liveData.py` once the server is running.
You will need to add an `apis.py` file with your `key` and `secret`, since Deribit requires API authentication for accessing their websocket endpoints.

## Screenshots

![Alt text](/screenshots/volsurface.PNG?raw=true)
