
-- ============================================================
-- Portfolio Manager — MySQL schema
-- Target: MySQL 8.0+ (needs 8.0.16+ for CHECK constraint enforcement)
-- Managed via Flyway migration V1__init_schema.sql
-- ============================================================

-- MySQL has no CREATE TYPE for enums — use inline ENUM(...) per column instead.

-- ------------------------------------------------------------
-- Portfolio: kept as an entity even for a single-user app.
-- Costs nothing now, avoids a migration if multi-portfolio is ever needed.
-- ------------------------------------------------------------
CREATE TABLE portfolio (
    portfolio_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL DEFAULT 'My Portfolio',
    base_currency   CHAR(3) NOT NULL DEFAULT 'EUR',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Instrument: one row per tradable thing, independent of whether it's
-- currently held. This is what price_history and risk metrics hang off.
-- ------------------------------------------------------------
CREATE TABLE instrument (
    instrument_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticker          VARCHAR(15) NOT NULL UNIQUE,
    name            VARCHAR(150) NOT NULL,
    asset_class     ENUM('STOCK', 'BOND', 'CASH', 'ETF') NOT NULL,
    sector          VARCHAR(100),
    currency        CHAR(3) NOT NULL DEFAULT 'EUR',
    exchange        VARCHAR(50),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Holding: current position only. What Browse / Add / Remove act on.
-- ------------------------------------------------------------
CREATE TABLE holding (
    holding_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id    BIGINT NOT NULL,
    instrument_id   BIGINT NOT NULL,
    quantity        DECIMAL(18,6) NOT NULL CHECK (quantity >= 0),
    avg_cost        DECIMAL(18,4) NOT NULL CHECK (avg_cost >= 0),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_holding_portfolio_instrument (portfolio_id, instrument_id),
    CONSTRAINT fk_holding_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_holding_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Transaction ledger: append-only. Needed to reconstruct historical
-- portfolio value, realised gains, and max drawdown — none of which
-- can be derived from `holding` alone.
-- ------------------------------------------------------------
CREATE TABLE portfolio_transaction (
    transaction_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id         BIGINT NOT NULL,
    instrument_id         BIGINT,  -- NULL for pure cash deposit/withdrawal
    type                 ENUM('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL') NOT NULL,
    quantity             DECIMAL(18,6),
    price                 DECIMAL(18,4),
    amount                 DECIMAL(18,4) NOT NULL,
    transaction_date     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes                 VARCHAR(255),
    CONSTRAINT fk_txn_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_txn_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_transaction_portfolio_date ON portfolio_transaction (portfolio_id, transaction_date DESC);

-- ------------------------------------------------------------
-- Price history: the table risk analysis is built on. Every risk metric
-- (volatility, VaR, beta, Sharpe, correlation) is a function over
-- consecutive rows here.
-- ------------------------------------------------------------
CREATE TABLE price_history (
    price_history_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    instrument_id       BIGINT NOT NULL,
    price_date           DATE NOT NULL,
    open_price           DECIMAL(18,4),
    high_price           DECIMAL(18,4),
    low_price             DECIMAL(18,4),
    close_price           DECIMAL(18,4) NOT NULL,
    volume                 BIGINT,
    UNIQUE KEY uq_price_instrument_date (instrument_id, price_date),
    CONSTRAINT fk_price_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_price_history_instrument_date ON price_history (instrument_id, price_date DESC);

-- ------------------------------------------------------------
-- Benchmark index (e.g. S&P 500) — separate from instrument because
-- it's never "held", only referenced for beta calculations.
-- ------------------------------------------------------------
CREATE TABLE benchmark_index (
    benchmark_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(20) NOT NULL UNIQUE,  -- e.g. ^GSPC
    name            VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE benchmark_price_history (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    benchmark_id    BIGINT NOT NULL,
    price_date      DATE NOT NULL,
    close_price     DECIMAL(18,4) NOT NULL,
    UNIQUE KEY uq_benchmark_price_date (benchmark_id, price_date),
    CONSTRAINT fk_bench_price_benchmark FOREIGN KEY (benchmark_id) REFERENCES benchmark_index(benchmark_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Risk metric snapshot: computed on a schedule (e.g. nightly batch job),
-- not live per-request. instrument_id NULL = portfolio-level metric;
-- populated = single-holding metric.
-- ------------------------------------------------------------
CREATE TABLE risk_metric_snapshot (
    snapshot_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id    BIGINT NOT NULL,
    instrument_id   BIGINT,
    snapshot_date   DATE NOT NULL,
    volatility      DECIMAL(10,6),   -- annualised std dev of returns
    beta            DECIMAL(10,6),   -- vs. benchmark
    sharpe_ratio    DECIMAL(10,6),
    max_drawdown    DECIMAL(10,6),   -- stored as negative fraction, e.g. -0.184
    var_95          DECIMAL(18,4),   -- 1-day VaR at 95% confidence, in base currency
    var_99          DECIMAL(18,4),
    UNIQUE KEY uq_risk_portfolio_instrument_date (portfolio_id, instrument_id, snapshot_date),
    CONSTRAINT fk_risk_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE,
    CONSTRAINT fk_risk_instrument FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_risk_snapshot_portfolio_date ON risk_metric_snapshot (portfolio_id, snapshot_date DESC);

-- ------------------------------------------------------------
-- AI insight log — optional for MVP, cheap to include now.
-- ------------------------------------------------------------
CREATE TABLE ai_insight (
    insight_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    portfolio_id    BIGINT NOT NULL,
    category        VARCHAR(50) NOT NULL,  -- REBALANCING, SUMMARY, ANOMALY
    content         TEXT NOT NULL,
    confidence      VARCHAR(20),
    generated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_insight_portfolio FOREIGN KEY (portfolio_id) REFERENCES portfolio(portfolio_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Seed a default portfolio so the app has something to point at on first run
-- ------------------------------------------------------------
INSERT INTO portfolio (name, base_currency) VALUES ('My Portfolio', 'EUR');