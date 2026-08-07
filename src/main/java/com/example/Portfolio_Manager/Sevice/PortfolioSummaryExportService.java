package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.dto.DashboardResponse;
import com.example.Portfolio_Manager.dto.HoldingPerformanceResponse;
import com.example.Portfolio_Manager.dto.PerformanceComparisonResponse;
import com.example.Portfolio_Manager.dto.PerformanceSummaryResponse;
import com.example.Portfolio_Manager.dto.PortfolioSummaryExportResponse;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class PortfolioSummaryExportService {

    private final PortfolioAnalyticsService portfolioAnalyticsService;
    private final PerformanceService performanceService;
    private final RiskAnalysisService riskAnalysisService;

    public PortfolioSummaryExportService(
            PortfolioAnalyticsService portfolioAnalyticsService,
            PerformanceService performanceService,
            RiskAnalysisService riskAnalysisService
    ) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
        this.performanceService = performanceService;
        this.riskAnalysisService = riskAnalysisService;
    }

    public PortfolioSummaryExportResponse getSummary(Long portfolioId, String range, int days, double concentrationThreshold) {
        DashboardResponse dashboard = portfolioAnalyticsService.getDashboard(portfolioId, days);

        PerformanceSummaryResponse performanceSummary = null;
        List<HoldingPerformanceResponse> performanceHoldings = List.of();
        PerformanceComparisonResponse performanceComparison = null;

        try {
            performanceSummary = performanceService.getSummary(portfolioId, range);
            performanceHoldings = performanceService.getHoldingsPerformance(portfolioId, range);
            performanceComparison = performanceService.getTopWorstHistory(portfolioId, range);
        } catch (ResponseStatusException exception) {
            // Keep export available even when performance data is partial or missing.
                        int statusCode = exception.getStatusCode().value();
                        if (statusCode != HttpStatus.NOT_FOUND.value()
                                        && statusCode != HttpStatus.BAD_REQUEST.value()) {
                throw exception;
            }
        }

        RiskAnalysisService.VolatilityReport volatilityReport = riskAnalysisService.computePortfolioVolatilityReport(true);
        double maxDrawdown = riskAnalysisService.computePortfolioMaxDrawdown();
        List<RiskAnalysisService.ConcentrationAlert> concentrationAlerts =
                riskAnalysisService.checkConcentration(concentrationThreshold);

        PortfolioSummaryExportResponse.VolatilitySummary volatility =
                new PortfolioSummaryExportResponse.VolatilitySummary(
                        volatilityReport.portfolioVolatility(),
                        volatilityReport.holdings().stream()
                                .map(holding -> new PortfolioSummaryExportResponse.HoldingVolatilitySummary(
                                        holding.ticker(),
                                        holding.volatility(),
                                        holding.sufficientData()
                                ))
                                .toList()
                );

        PortfolioSummaryExportResponse.RiskSummary risk =
                new PortfolioSummaryExportResponse.RiskSummary(
                        volatility,
                        maxDrawdown,
                        concentrationAlerts.stream()
                                .map(alert -> new PortfolioSummaryExportResponse.ConcentrationAlertSummary(
                                        alert.ticker(),
                                        alert.currentWeight(),
                                        alert.threshold()
                                ))
                                .toList()
                );

        return new PortfolioSummaryExportResponse(
                portfolioId,
                range,
                dashboard,
                performanceSummary,
                performanceHoldings,
                performanceComparison,
                risk
        );
    }
}