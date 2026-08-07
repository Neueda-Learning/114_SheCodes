package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PerformancePointResponse(
        LocalDate priceDate,
        BigDecimal returnPercentage
) {
}