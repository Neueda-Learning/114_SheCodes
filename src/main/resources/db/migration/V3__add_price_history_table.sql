CREATE TABLE IF NOT EXISTS price_history (
    price_history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instrument_id BIGINT NOT NULL,
    price_date DATE NOT NULL,
    open_price DECIMAL(18,4),
    high_price DECIMAL(18,4),
    low_price DECIMAL(18,4),
    close_price DECIMAL(18,4) NOT NULL,
    volume BIGINT,
    UNIQUE KEY uq_price_instrument_date (instrument_id, price_date),
    CONSTRAINT fk_price_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
