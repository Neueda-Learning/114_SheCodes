package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.PortfolioAnalyticsService;
import com.example.Portfolio_Manager.Sevice.PortfolioSummaryExportService;
import com.example.Portfolio_Manager.dto.DashboardResponse;
import com.example.Portfolio_Manager.dto.PortfolioSummaryExportResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/portfolio/{portfolioId}/dashboard")
@Tag(
        name = "Dashboard APIs",
        description = "APIs for dashboard cards and related value/allocation data"
)
public class DashboardController {

    private final PortfolioAnalyticsService portfolioAnalyticsService;
        private final PortfolioSummaryExportService portfolioSummaryExportService;

        public DashboardController(
                        PortfolioAnalyticsService portfolioAnalyticsService,
                        PortfolioSummaryExportService portfolioSummaryExportService
        ) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
                this.portfolioSummaryExportService = portfolioSummaryExportService;
    }

    @Operation(
            summary = "Get dashboard overview",
            description = "Returns cards (current asset value, invested value, return, holdings), value-over-time series and sector allocation"
    )
    @GetMapping
    public DashboardResponse getDashboard(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue = "30") int days
    ) {
        return portfolioAnalyticsService.getDashboard(portfolioId, days);
    }

    @Operation(
            summary = "Refresh historical prices",
            description = "Loads and stores historical close prices from Yahoo Finance for instruments in the portfolio"
    )
    @PostMapping("/refresh-prices")
    public Map<String, Integer> refreshPrices(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue = "90") int days
    ) {
        return portfolioAnalyticsService.refreshPriceHistory(portfolioId, days);
    }

        @Operation(
                        summary = "Get portfolio summary export payload",
                        description = "Returns dashboard, performance and risk analytics in one response for PDF export"
        )
        @GetMapping("/export-summary")
        public PortfolioSummaryExportResponse getPortfolioSummaryExport(
                        @PathVariable Long portfolioId,
                        @RequestParam(defaultValue = "1M") String range,
                        @RequestParam(defaultValue = "365") int days,
                        @RequestParam(defaultValue = "0.25") double threshold
        ) {
                return portfolioSummaryExportService.getSummary(portfolioId, range, days, threshold);
        }
}
