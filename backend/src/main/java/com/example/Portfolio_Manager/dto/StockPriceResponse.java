package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public record StockPriceResponse(
        String symbol,
        BigDecimal currentPrice
) {
}