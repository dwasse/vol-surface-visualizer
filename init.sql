DROP DATABASE "vol_surface_visualizer";
CREATE DATABASE "vol_surface_visualizer";

\c vol_surface_visualizer

CREATE USER "vol_admin" WITH ENCRYPTED PASSWORD 'password';

CREATE TABLE IF NOT EXISTS contract_summaries(
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    vol DOUBLE PRECISION,
    bid_vol DOUBLE PRECISION,
    ask_vol DOUBLE PRECISION,
    strike INT,
    expiry TIMESTAMP,
    delta DOUBLE PRECISION,
    gamma DOUBLE PRECISION,
    vega DOUBLE PRECISION,
    theta DOUBLE PRECISION
);

GRANT ALL PRIVILEGES ON TABLE contract_summaries TO vol_admin;
GRANT USAGE, SELECT ON SEQUENCE contract_summaries_id_seq TO vol_admin;

CREATE TABLE IF NOT EXISTS order_snapshots(
    id SERIAL PRIMARY KEY,
    timestamp BIGINT NOT NULL,
    symbol TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL
);

GRANT ALL PRIVILEGES ON TABLE order_snapshots TO vol_admin;
GRANT USAGE, SELECT ON SEQUENCE order_snapshots_id_seq TO vol_admin;
\q