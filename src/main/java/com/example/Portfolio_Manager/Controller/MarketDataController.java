package com.example.Portfolio_Manager.Controller;


import com.example.Portfolio_Manager.Sevice.YahooFinanceService;
import com.example.Portfolio_Manager.dto.StockPriceResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;


@RestController
@RequestMapping("/api/market")
@Tag(
        name = "Market Data APIs",
        description = "APIs for fetching real-time stock market data using Yahoo Finance"
)
public class MarketDataController {


    private final YahooFinanceService yahooFinanceService;


    public MarketDataController(
            YahooFinanceService yahooFinanceService) {

        this.yahooFinanceService = yahooFinanceService;
    }



    @Operation(
            summary = "Get current stock price",
            description = "Fetches the latest stock price for a given ticker symbol using Yahoo Finance API"
    )
    @GetMapping("/price/{symbol}")
    public StockPriceResponse getPrice(
            @PathVariable String symbol) {


        BigDecimal price =
                yahooFinanceService.getCurrentPrice(symbol);


        return new StockPriceResponse(
                symbol.toUpperCase(),
                price
        );
    }
}