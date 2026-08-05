package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record DashboardResponse(
	OffsetDateTime asOf,
	String baseCurrency,
	BigDecimal totalPortfolioValue,
	BigDecimal totalAssetsCurrentValue,
	BigDecimal totalInvestedAmount,
	BigDecimal totalAssetsInvestedValue,
	BigDecimal totalReturnAmount,
	BigDecimal totalReturnPercentage,
	BigDecimal investedPercentage,
	int holdingsCount,
	int totalAssetsCount,
	BigDecimal totalQuantity,
	int stockCount,
	int etfCount,
	int bondCount,
	int cashInstrumentCount,
	BigDecimal cashAvailable,
	BigDecimal cashAvailablePercentage,
	String livePriceFetchStatus,
	int stalePriceCount,
	BigDecimal dayReturnAmount,
	BigDecimal dayReturnPercentage,
	List<ValuePoint> valueOverTime,
	List<AllocationSlice> sectorAllocation
) {

    public record ValuePoint(LocalDate date, BigDecimal value) {
    }

    public record AllocationSlice(
	    String label,
	    BigDecimal value,
	    BigDecimal percentage
    ) {
    }
}
