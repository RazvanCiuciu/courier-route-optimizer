DROP TABLE IF EXISTS route_stops, routes, time_windows, orders, clients CASCADE;
DROP TYPE IF EXISTS route_status, order_status, delivery_day;

CREATE TYPE delivery_day AS ENUM ('thursday', 'friday');
CREATE TYPE order_status AS ENUM ('pending', 'assigned', 'delivered', 'failed_attempt', 'dropped');
CREATE TYPE route_status AS ENUM ('preview', 'committed');

CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION
);

CREATE TABLE orders(
    id SERIAL PRIMARY KEY,
    client_id INT NOT NULL REFERENCES clients(id),
    assigned_day delivery_day,
    delivery_week DATE NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    drop_reason TEXT
);

CREATE TABLE time_windows (
    id          SERIAL PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    day         delivery_day NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    CONSTRAINT valid_window CHECK (start_time < end_time)
);

CREATE TABLE routes (
    id              SERIAL PRIMARY KEY,
    delivery_week   DATE NOT NULL,
    day             delivery_day NOT NULL,
    vehicle_index   INT NOT NULL DEFAULT 0,
    total_time_min  INT,
    status          route_status NOT NULL DEFAULT 'preview',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE route_stops (
    id                SERIAL PRIMARY KEY,
    route_id          INT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    order_id          INT NOT NULL REFERENCES orders(id),
    sequence          INT NOT NULL,
    eta_min           INT,
    chosen_window_id  INT REFERENCES time_windows(id),
    UNIQUE (route_id, sequence)
);

CREATE INDEX idx_orders_week_status  ON orders (delivery_week, status);
CREATE INDEX idx_time_windows_order  ON time_windows (order_id);
CREATE INDEX idx_route_stops_route   ON route_stops (route_id, sequence);