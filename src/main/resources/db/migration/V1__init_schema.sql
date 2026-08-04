CREATE TABLE portfolio (
    portfolio_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT 'My Portfolio',
    base_currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE instrument (
    instrument_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticker VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    asset_class ENUM('STOCK', 'BOND', 'CASH', 'ETF') NOT NULL,
    sector VARCHAR(100),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    exchange VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE holding (
    holding_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id BIGINT NOT NULL,
    instrument_id BIGINT NOT NULL,
    quantity DECIMAL(18,6) NOT NULL,
    avg_cost DECIMAL(18,4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_holding_portfolio_instrument (portfolio_id, instrument_id),
    CONSTRAINT fk_holding_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_holding_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO portfolio (name, base_currency)
SELECT 'My Portfolio', 'USD'
WHERE NOT EXISTS (
    SELECT 1 FROM portfolio
);