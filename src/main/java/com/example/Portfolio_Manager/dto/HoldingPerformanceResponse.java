package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public record HoldingPerformanceResponse(
        Long holdingId,
        Long instrumentId,
        String ticker,
        String instrumentName,
        BigDecimal quantity,
        BigDecimal currentPrice,
        BigDecimal currentValue,
        BigDecimal rangeReturnPercentage,
        BigDecimal totalReturnPercentage
) {
}