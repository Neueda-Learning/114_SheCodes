 # 📊 Portfolio Manager

A portfolio management application that allows users to manage their investments, track holdings, analyze portfolio performance, visualize investment distribution, and understand portfolio risks.

The application provides users with a centralized platform to add, view, and manage their investments while generating meaningful insights through dashboards, performance analysis, and risk metrics.

---

# 🚀 Features

## 1. Holdings Management

The Holdings module allows users to manage all their investments in one place.

Features:
- View all current holdings in the portfolio.
- Add new holdings by selecting an available company/instrument.
- Enter investment quantity and average purchase cost.
- Delete existing holdings.
- Maintain portfolio investment records.

---

## 2. Dashboard

The Dashboard provides a visual representation of the user's portfolio.

Features:
- Portfolio summary overview.
- Investment distribution using pie charts.
- Asset allocation visualization.
- Graphical representation of portfolio composition.

---

## 3. Performance Analysis

The Performance module helps users analyze their investment growth.

Features:
- Track portfolio value over time.
- View investment returns.
- Analyze profit/loss trends.
- Display performance graphs for better decision-making.

---

## 4. Risk Analysis

The Risk Analysis module evaluates the risk associated with user investments.

Features:
- Portfolio volatility calculation.
- Beta analysis.
- Sharpe ratio calculation.
- Maximum drawdown analysis.
- Value at Risk (VaR) calculation.

---

# 🏗️ Application Architecture

```
                 Frontend
                    |
                    |
               REST APIs
                    |
                    |
             Spring Boot Backend
                    |
        ---------------------------
        |            |            |
    Controller    Service    Repository
                                  |
                                  |
                              MySQL DB
```

---

# 🛠️ Tech Stack

## Backend
- Java 21
- Spring Boot
- Spring Web
- Spring Data JPA
- Hibernate
- REST APIs
- Maven

## Database
- MySQL 8.0+
- Flyway Migration

## Tools
- IntelliJ IDEA
- Git & GitHub
- Postman
- MySQL Workbench

---

# 🗄️ Database Design

The application uses a relational database with the following main entities:

## Portfolio

Stores portfolio information.

Columns:

| Column | Description |
|--------|-------------|
| portfolio_id | Unique portfolio identifier |
| name | Portfolio name |
| base_currency | Portfolio currency |
| created_at | Creation timestamp |

---

## Instrument

Stores available investment instruments.

Examples:
- Stocks
- ETFs
- Bonds

Columns:

| Column | Description |
|--------|-------------|
| instrument_id | Unique instrument ID |
| ticker | Stock symbol |
| name | Company name |
| asset_class | Type of investment |
| sector | Industry sector |
| currency | Trading currency |
| exchange | Stock exchange |

---

## Holding

Stores current user investments.

Columns:

| Column | Description |
|--------|-------------|
| holding_id | Unique holding ID |
| portfolio_id | Related portfolio |
| instrument_id | Related company/instrument |
| quantity | Number of units owned |
| avg_cost | Average buying cost |
| created_at | Creation time |
| updated_at | Last update time |

---

## Portfolio Transaction

Stores investment transactions.

Supported transaction types:

- BUY
- SELL
- DIVIDEND
- INTEREST
- DEPOSIT
- WITHDRAWAL

---

## Price History

Stores historical prices of instruments.

Used for:
- Performance calculation
- Return calculation
- Risk analysis

---

## Risk Metric Snapshot

Stores calculated portfolio risk metrics.

Metrics include:

- Volatility
- Beta
- Sharpe Ratio
- Maximum Drawdown
- VaR

---

# 🔗 REST API Endpoints

Base URL:

```
http://localhost:8080
```

---

# Holdings APIs

## 1. Get All Holdings

Fetches all holdings of a portfolio.

### Request

```
GET /api/portfolio/{portfolioId}/holdings
```

Example:

```
GET /api/portfolio/1/holdings
```

Response:

```json
[
    {
        "holdingId":1,
        "company":"Microsoft Corporation",
        "ticker":"MSFT",
        "quantity":10,
        "avgCost":150.50
    }
]
```

---

## 2. Add Holding

Adds a new investment to the portfolio.

### Request

```
POST /api/portfolio/{portfolioId}/holdings
```

Example:

```
POST /api/portfolio/1/holdings
```

Request Body:

```json
{
    "instrumentId":2,
    "quantity":10,
    "avgCost":150.50
}
```

---

## 3. Delete Holding

Deletes an existing holding.

### Request

```
DELETE /api/portfolio/holdings/{holdingId}
```

Example:

```
DELETE /api/portfolio/holdings/1
```

---

# Instrument APIs

## Get Available Instruments

Fetches companies available for adding to portfolio.

```
GET /api/instruments
```

Example Response:

```json
[
    {
        "instrumentId":1,
        "ticker":"AAPL",
        "name":"Apple Inc."
    }
]
```

---

# Dashboard APIs

## Portfolio Dashboard Summary

Returns portfolio overview information.

```
GET /api/portfolio/{portfolioId}/dashboard
```

Provides:

- Total investment value
- Number of holdings
- Portfolio score
- Portfolio summary

---

## Portfolio Allocation

Provides data for graphical charts.

```
GET /api/portfolio/{portfolioId}/allocation
```

Returns:

- Asset distribution
- Sector allocation
- Investment percentage

---

# Performance APIs

## Portfolio Performance

Provides historical performance data.

```
GET /api/portfolio/{portfolioId}/performance
```

Returns:

- Portfolio value trends
- Investment growth
- Returns over time

---

# Risk Analysis APIs

## Portfolio Risk Metrics

Returns calculated risk information.

```
GET /api/portfolio/{portfolioId}/risk
```

Provides:

- Volatility
- Concentraion
- Maximum Drawdown

---

# ⚙️ Setup Instructions

## 1. Clone Repository

```bash
git clone <repository-url>
```

---

## 2. Create MySQL Database

Open MySQL and run:

```sql
CREATE DATABASE portfolio_db;
```

---

## 3. Configure Database Connection

Update:

```
src/main/resources/application.properties
```

Example:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/portfolio_db
spring.datasource.username=root
spring.datasource.password=<password>

spring.jpa.hibernate.ddl-auto=validate

spring.flyway.enabled=true
```

---

## 4. Run Application

Using Maven:

```bash
mvn spring-boot:run
```

Application runs on:

```
http://localhost:8080
```

---

# 📌 Future Enhancements

- User authentication and authorization
- Import holdings through CSV files
- Export portfolio statements as PDF
- Real-time stock price integration
- AI-based investment recommendations
- Multiple portfolio support

---

# 👩‍💻 Team

**SheCodes Team**

Project: Portfolio Manager
