package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.PortfolioAnalyticsService;
import com.example.Portfolio_Manager.dto.DashboardResponse;
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

    public DashboardController(PortfolioAnalyticsService portfolioAnalyticsService) {
        this.portfolioAnalyticsService = portfolioAnalyticsService;
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
}
