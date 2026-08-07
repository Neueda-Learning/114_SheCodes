package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.dto.HoldingPerformanceResponse;
import com.example.Portfolio_Manager.dto.PerformanceComparisonResponse;
import com.example.Portfolio_Manager.dto.PerformanceSummaryResponse;

import java.util.List;

public interface PerformanceService {

    PerformanceSummaryResponse getSummary(Long portfolioId, String range);

    List<HoldingPerformanceResponse> getHoldingsPerformance(Long portfolioId, String range);

    PerformanceComparisonResponse getTopWorstHistory(Long portfolioId, String range);
}