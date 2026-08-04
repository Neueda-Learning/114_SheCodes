package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public record HoldingResponse(

        Long holdingId,

        Long portfolioId,

        Long instrumentId,

        String ticker,

        BigDecimal quantity,

        BigDecimal avgCost,

        BigDecimal currentPrice,

        BigDecimal currentValue

) {
}