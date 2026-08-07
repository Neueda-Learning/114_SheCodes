package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public record PerformerSnapshotResponse(
        Long holdingId,
        Long instrumentId,
        String ticker,
        String instrumentName,
        BigDecimal returnPercentage,
        BigDecimal currentPrice,
        BigDecimal currentValue
) {
}