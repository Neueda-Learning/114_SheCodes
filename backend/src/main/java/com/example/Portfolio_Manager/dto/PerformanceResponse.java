package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public record PerformanceResponse(
	Long holdingId,
	String ticker,
	BigDecimal returnPercentage
) {
}
