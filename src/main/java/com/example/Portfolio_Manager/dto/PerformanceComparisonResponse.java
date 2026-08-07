package com.example.Portfolio_Manager.dto;

import java.util.List;

public record PerformanceComparisonResponse(
        Long portfolioId,
        String range,
        PerformerSnapshotResponse bestPerformer,
        PerformerSnapshotResponse worstPerformer,
        List<PerformancePointResponse> bestPerformerSeries,
        List<PerformancePointResponse> worstPerformerSeries
) {
}