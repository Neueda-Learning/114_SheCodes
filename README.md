Dashboard Module

=> The Dashboard Module provides a consolidated, at-a-glance view of portfolio health. 
=> It summarizes portfolio value, returns, holdings composition, cash exposure, sector allocation, and recent value trend using real-time and historical market data.

Features
- Portfolio Summary Cards — Displays:
  - Total portfolio value
  - Total invested amount
  - Total profit&loss (amount and %)
  - Invested %
  
- Holdings Summary — Displays:
  - Holdings count
  - Total assets count
  - Total quantity
  - Asset-class counts (Stock, ETF, Bond)
- Value Over Time: Returns date-wise portfolio values for chart plotting over selected days.
- Sector Allocation: Returns sector-wise distribution (value and percentage) for pie/donut charts.
  
- Historical Price Refresh — Pulls missing historical close-price rows from Yahoo Finance into local DB for better chart consistency.

APIs

GET  /api/portfolio/{portfolioId}/dashboard?days={n}
POST /api/portfolio/{portfolioId}/dashboard/refresh-prices?days={n}

- Dashboard uses live prices when available and falls back to stored historical prices when needed.
- refresh-prices does not modify holding quantity or average cost.
- Risk Analysis and Top/Worst Performance logic are excluded from this module scope.
