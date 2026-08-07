package com.example.Portfolio_Manager.dto;

public record PerformanceSummaryResponse(
        Long portfolioId,
        String range,
        PerformerSnapshotResponse bestPerformer,
        PerformerSnapshotResponse worstPerformer
) {
}