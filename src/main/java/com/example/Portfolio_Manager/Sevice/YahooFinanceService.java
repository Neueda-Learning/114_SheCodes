package com.example.Portfolio_Manager.Sevice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class YahooFinanceService {

    private static final Duration LIVE_PRICE_TTL = Duration.ofSeconds(60);

    private final RestTemplate restTemplate;

    private final ObjectMapper objectMapper;

    private final Map<String, CachedPrice> priceCache;


    public YahooFinanceService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
        this.priceCache = new ConcurrentHashMap<>();
    }


    public BigDecimal getCurrentPrice(String symbol) {

        String normalizedSymbol = symbol.toUpperCase(Locale.ROOT);

        CachedPrice cachedPrice = priceCache.get(normalizedSymbol);
        if (cachedPrice != null && !cachedPrice.isExpired()) {
            return cachedPrice.price();
        }

        String url =
                "https://query1.finance.yahoo.com/v8/finance/chart/"
                        + normalizedSymbol;

        try {
            String response = fetchYahooResponse(url);
            BigDecimal currentPrice = extractPrice(normalizedSymbol, response);
            priceCache.put(normalizedSymbol, new CachedPrice(currentPrice, Instant.now()));
            return currentPrice;
        } catch (HttpClientErrorException.TooManyRequests exception) {
            if (cachedPrice != null) {
                return cachedPrice.price();
            }

            throw new IllegalStateException(
                    "Yahoo Finance rate limit exceeded for symbol: " + normalizedSymbol,
                    exception
            );
        } catch (RuntimeException exception) {
            if (cachedPrice != null) {
                return cachedPrice.price();
            }

            throw exception;
        }
    }


    public Map<LocalDate, BigDecimal> getHistoricalClosePrices(String symbol, int days) {
        String normalizedSymbol = symbol.toUpperCase(Locale.ROOT);
        String range = toYahooRange(days);
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/"
                + normalizedSymbol
                + "?range=" + range
                + "&interval=1d";

        String response = fetchYahooResponse(url);
        return extractHistoricalCloses(normalizedSymbol, response);
    }


    private String fetchYahooResponse(String url) {
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0");
        headers.set(HttpHeaders.ACCEPT, "application/json");

        ResponseEntity<String> response = restTemplate.exchange(
                url,
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        return response.getBody();
    }


    private BigDecimal extractPrice(String normalizedSymbol, String response) {

        if (response == null || response.isBlank()) {
            throw new IllegalStateException("Empty response from Yahoo Finance for symbol: " + normalizedSymbol);
        }

        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode priceNode = root.path("chart")
                    .path("result")
                    .path(0)
                    .path("meta")
                    .path("regularMarketPrice");

            if (priceNode.isMissingNode() || priceNode.isNull()) {
                throw new IllegalStateException("Price not found for symbol: " + normalizedSymbol);
            }

            return priceNode.decimalValue();
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to parse Yahoo Finance response for symbol: " + normalizedSymbol,
                    exception
            );
        }
    }


    private Map<LocalDate, BigDecimal> extractHistoricalCloses(String normalizedSymbol, String response) {
        if (response == null || response.isBlank()) {
            throw new IllegalStateException("Empty historical response from Yahoo Finance for symbol: " + normalizedSymbol);
        }

        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.path("chart").path("result").path(0);
            JsonNode timestamps = result.path("timestamp");
            JsonNode closes = result.path("indicators").path("adjclose").path(0).path("adjclose");

            if (!timestamps.isArray() || !closes.isArray()) {
                throw new IllegalStateException("Historical price series not found for symbol: " + normalizedSymbol);
            }

            int length = Math.min(timestamps.size(), closes.size());
            Map<LocalDate, BigDecimal> history = new LinkedHashMap<>();

            for (int i = 0; i < length; i++) {
                JsonNode timestampNode = timestamps.get(i);
                JsonNode closeNode = closes.get(i);

                if (timestampNode == null || closeNode == null || closeNode.isNull()) {
                    continue;
                }

                long epochSeconds = timestampNode.asLong();
                LocalDate date = Instant.ofEpochSecond(epochSeconds)
                        .atZone(ZoneOffset.UTC)
                        .toLocalDate();
                history.put(date, closeNode.decimalValue());
            }

            return history;
        } catch (IOException exception) {
            throw new IllegalStateException(
                    "Unable to parse Yahoo Finance historical response for symbol: " + normalizedSymbol,
                    exception
            );
        }
    }


    private String toYahooRange(int days) {
        if (days <= 7) {
            return "1mo";
        }
        if (days <= 30) {
            return "3mo";
        }
        if (days <= 90) {
            return "6mo";
        }
        if (days <= 180) {
            return "1y";
        }
        return "2y";
    }


    private record CachedPrice(BigDecimal price, Instant fetchedAt) {

        private boolean isExpired() {
            return fetchedAt.plus(LIVE_PRICE_TTL).isBefore(Instant.now());
        }
    }
}