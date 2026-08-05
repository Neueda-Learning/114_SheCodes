package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.PriceHistoryImportService;
import com.example.Portfolio_Manager.Sevice.YahooFinanceService;
import com.example.Portfolio_Manager.dto.StockPriceResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/market")
@Tag(
        name = "Market Data APIs",
        description = "APIs for fetching real-time stock market data using Yahoo Finance"
)
public class MarketDataController {

    private final YahooFinanceService yahooFinanceService;
    private final PriceHistoryImportService priceHistoryImportService;

    public MarketDataController(
            YahooFinanceService yahooFinanceService,
            PriceHistoryImportService priceHistoryImportService) {
        this.yahooFinanceService = yahooFinanceService;
        this.priceHistoryImportService = priceHistoryImportService;
    }

    @Operation(
            summary = "Get current stock price",
            description = "Fetches the latest stock price for a given ticker symbol using Yahoo Finance API"
    )
    @GetMapping("/price/{symbol}")
    public StockPriceResponse getPrice(@PathVariable String symbol) {
        BigDecimal price = yahooFinanceService.getCurrentPrice(symbol);
        return new StockPriceResponse(symbol.toUpperCase(), price);
    }

    @Operation(
            summary = "Import historical prices",
            description = "Fetches historical daily close prices from Yahoo Finance and saves them into price_history"
    )
    @PostMapping("/history/{symbol}")
    public ResponseEntity<Map<String, Object>> importHistory(
            @PathVariable String symbol,
            @RequestParam(defaultValue = "252") int days) {
        int saved = priceHistoryImportService.importHistory(symbol, days);
        return ResponseEntity.ok(Map.of(
                "symbol", symbol.toUpperCase(),
                "recordsSaved", saved
        ));
    }
}