 Holdings Module

 Overview

The Holdings Module is responsible for managing and displaying the investments held in a user's portfolio. It allows users to add, view, and remove holdings while fetching **real-time market data from Yahoo Finance** to keep current prices and portfolio values up to date.

 Features

View Holdings — Displays all investments with details such as ticker, quantity, average cost, current price, market value, and gain/loss.
Add Holding — Allows users to add a new stock/investment to their portfolio.
Remove Holding — Allows users to remove an existing investment.
Real-Time Market Data — Fetches the latest stock prices and relevant market information from Yahoo Finance using the instrument's ticker symbol.
Gain/Loss Calculation — Calculates the current value and performance of holdings using the latest market price.

 APIs

text
GET    /api/holdings
POST   /api/holdings
DELETE /api/holdings/{id}


 Technology

 Java
 Spring Boot
 Spring Data JPA / Hibernate
 MySQL
 REST APIs
 Yahoo Finance market data

This module provides the current investment and market-price data required by the Dashboard, Performance, and Risk Analysis modules.
