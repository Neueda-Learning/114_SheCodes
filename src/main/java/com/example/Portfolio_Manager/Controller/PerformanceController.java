package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.PerformanceService;
import com.example.Portfolio_Manager.dto.HoldingPerformanceResponse;
import com.example.Portfolio_Manager.dto.PerformanceComparisonResponse;
import com.example.Portfolio_Manager.dto.PerformanceSummaryResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/portfolio/{portfolioId}/performance")
@Tag(
        name = "Performance APIs",
        description = "APIs for top performer, worst performer and range-based performance charts"
)
public class PerformanceController {

    private final PerformanceService performanceService;

    public PerformanceController(PerformanceService performanceService) {
        this.performanceService = performanceService;
    }

    @Operation(
            summary = "Get performance summary",
            description = "Returns the best and worst performer for the selected range using the portfolio holdings"
    )
    @GetMapping("/summary")
    public PerformanceSummaryResponse getSummary(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue = "1M") String range
    ) {
        return performanceService.getSummary(portfolioId, range);
    }

    @Operation(
            summary = "Get holding performance list",
            description = "Returns range performance for every holding in the portfolio so the frontend can render cards or ranking lists"
    )
    @GetMapping("/holdings")
    public List<HoldingPerformanceResponse> getHoldings(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue = "1M") String range
    ) {
        return performanceService.getHoldingsPerformance(portfolioId, range);
    }

    @Operation(
            summary = "Get top and worst performer history",
            description = "Returns two rebased time series for the current top and worst performer over 1D, 1W, 1M or 1Y"
    )
    @GetMapping("/top-worst-history")
    public PerformanceComparisonResponse getTopWorstHistory(
            @PathVariable Long portfolioId,
            @RequestParam(defaultValue = "1M") String range
    ) {
        return performanceService.getTopWorstHistory(portfolioId, range);
    }
}