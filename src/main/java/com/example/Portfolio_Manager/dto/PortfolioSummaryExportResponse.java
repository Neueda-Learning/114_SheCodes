package com.example.Portfolio_Manager.dto;

import java.util.List;

public record PortfolioSummaryExportResponse(
        Long portfolioId,
        String range,
        DashboardResponse dashboard,
        PerformanceSummaryResponse performanceSummary,
        List<HoldingPerformanceResponse> performanceHoldings,
        PerformanceComparisonResponse performanceComparison,
        RiskSummary risk
) {

    public record RiskSummary(
            VolatilitySummary volatility,
            Double maxDrawdown,
            List<ConcentrationAlertSummary> concentrationAlerts
    ) {
    }

    public record VolatilitySummary(
            Double portfolioVolatility,
            List<HoldingVolatilitySummary> holdings
    ) {
    }

    public record HoldingVolatilitySummary(
            String ticker,
            Double volatility,
            boolean sufficientData
    ) {
    }

    public record ConcentrationAlertSummary(
            String ticker,
            double currentWeight,
            double threshold
    ) {
    }
}