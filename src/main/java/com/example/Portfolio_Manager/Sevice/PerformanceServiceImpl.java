package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.PriceHistory;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.PortfolioRepository;
import com.example.Portfolio_Manager.Repository.PriceHistoryRepository;
import com.example.Portfolio_Manager.dto.HoldingPerformanceResponse;
import com.example.Portfolio_Manager.dto.PerformanceComparisonResponse;
import com.example.Portfolio_Manager.dto.PerformancePointResponse;
import com.example.Portfolio_Manager.dto.PerformanceSummaryResponse;
import com.example.Portfolio_Manager.dto.PerformerSnapshotResponse;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class PerformanceServiceImpl implements PerformanceService {

    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final HoldingRepository holdingRepository;
    private final PortfolioRepository portfolioRepository;
    private final PriceHistoryRepository priceHistoryRepository;
    private final YahooFinanceService yahooFinanceService;

    public PerformanceServiceImpl(
            HoldingRepository holdingRepository,
            PortfolioRepository portfolioRepository,
            PriceHistoryRepository priceHistoryRepository,
            YahooFinanceService yahooFinanceService
    ) {
        this.holdingRepository = holdingRepository;
        this.portfolioRepository = portfolioRepository;
        this.priceHistoryRepository = priceHistoryRepository;
        this.yahooFinanceService = yahooFinanceService;
    }

    @Override
    public PerformanceSummaryResponse getSummary(Long portfolioId, String range) {
        PerformanceRange performanceRange = PerformanceRange.from(range);
        List<HoldingMetrics> metrics = loadMetrics(portfolioId, performanceRange);

        return new PerformanceSummaryResponse(
                portfolioId,
                performanceRange.apiValue(),
                toSnapshot(metrics.getFirst()),
                toSnapshot(metrics.getLast())
        );
    }

    @Override
    public List<HoldingPerformanceResponse> getHoldingsPerformance(Long portfolioId, String range) {
        PerformanceRange performanceRange = PerformanceRange.from(range);
        List<HoldingMetrics> metrics = loadMetrics(portfolioId, performanceRange);

        return metrics.stream()
                .sorted(Comparator.comparing(HoldingMetrics::rangeReturnPercentage).reversed())
                .map(metric -> new HoldingPerformanceResponse(
                        metric.holdingId(),
                        metric.instrumentId(),
                        metric.ticker(),
                        metric.instrumentName(),
                        metric.quantity(),
                        metric.currentPrice(),
                        metric.currentValue(),
                        metric.rangeReturnPercentage(),
                        metric.totalReturnPercentage()
                ))
                .toList();
    }

    @Override
    public PerformanceComparisonResponse getTopWorstHistory(Long portfolioId, String range) {
        PerformanceRange performanceRange = PerformanceRange.from(range);
        List<HoldingMetrics> metrics = loadMetrics(portfolioId, performanceRange);

        HoldingMetrics best = metrics.getFirst();
        HoldingMetrics worst = metrics.getLast();

        return new PerformanceComparisonResponse(
                portfolioId,
                performanceRange.apiValue(),
                toSnapshot(best),
                toSnapshot(worst),
                buildSeries(best, performanceRange),
                buildSeries(worst, performanceRange)
        );
    }

    private List<HoldingMetrics> loadMetrics(Long portfolioId, PerformanceRange range) {
        ensurePortfolioExists(portfolioId);

        List<Holding> holdings = holdingRepository.findByPortfolio_PortfolioId(portfolioId);
        if (holdings.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No holdings found for portfolio: " + portfolioId);
        }

        LocalDate endDate = LocalDate.now();
        LocalDate startDate = range.startDate(endDate);

        List<HoldingMetrics> metrics = holdings.stream()
            .map(holding -> buildMetrics(holding, startDate))
            .flatMap(Optional::stream)
                .sorted(Comparator.comparing(HoldingMetrics::rangeReturnPercentage).reversed())
                .toList();

        if (metrics.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No performance data available for portfolio: " + portfolioId);
        }

        return metrics;
    }

            private Optional<HoldingMetrics> buildMetrics(Holding holding, LocalDate startDate) {
        Long instrumentId = holding.getInstrument().getInstrumentId();
        String ticker = holding.getInstrument().getTicker();

            Optional<PriceHistory> baseHistory = priceHistoryRepository
                .findTopByInstrument_InstrumentIdAndPriceDateLessThanEqualOrderByPriceDateDesc(instrumentId, startDate);

            Optional<PriceHistory> latestHistory = priceHistoryRepository
                .findTopByInstrument_InstrumentIdOrderByPriceDateDesc(instrumentId);

            BigDecimal basePrice = baseHistory
                .map(PriceHistory::getClosePrice)
                .orElse(holding.getAvgCost());

            if (basePrice == null || basePrice.compareTo(BigDecimal.ZERO) <= 0) {
                return Optional.empty();
            }

            BigDecimal fallbackCurrentPrice = latestHistory
                .map(PriceHistory::getClosePrice)
                .orElse(basePrice);

            BigDecimal currentPrice = getLiveOrHistoricalPrice(ticker, fallbackCurrentPrice);
        BigDecimal currentValue = currentPrice.multiply(holding.getQuantity()).setScale(4, RoundingMode.HALF_UP);
            BigDecimal rangeReturnPercentage = calculateReturnPercentage(basePrice, currentPrice);
        BigDecimal totalReturnPercentage = calculateReturnPercentage(holding.getAvgCost(), currentPrice);

            return Optional.of(new HoldingMetrics(
                holding.getHoldingId(),
                instrumentId,
                ticker,
                holding.getInstrument().getName(),
                holding.getQuantity(),
                currentPrice,
                currentValue,
                rangeReturnPercentage,
                totalReturnPercentage,
                basePrice
            ));
    }

    private List<PerformancePointResponse> buildSeries(HoldingMetrics metric, PerformanceRange range) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = range.startDate(endDate);

        List<PriceHistory> history = priceHistoryRepository
                .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                        metric.instrumentId(),
                        startDate,
                        endDate
                );

        if (history.isEmpty()) {
            return List.of(new PerformancePointResponse(
                LocalDate.now(),
                metric.rangeReturnPercentage()
            ));
        }

        return history.stream()
                .map(point -> new PerformancePointResponse(
                        point.getPriceDate(),
                        calculateReturnPercentage(metric.basePrice(), point.getClosePrice())
                ))
                .toList();
    }

    private PerformerSnapshotResponse toSnapshot(HoldingMetrics metric) {
        return new PerformerSnapshotResponse(
                metric.holdingId(),
                metric.instrumentId(),
                metric.ticker(),
                metric.instrumentName(),
                metric.rangeReturnPercentage(),
                metric.currentPrice(),
                metric.currentValue()
        );
    }

    private BigDecimal getLiveOrHistoricalPrice(String ticker, BigDecimal fallbackPrice) {
        try {
            return yahooFinanceService.getCurrentPrice(ticker).setScale(4, RoundingMode.HALF_UP);
        } catch (RuntimeException exception) {
            return fallbackPrice.setScale(4, RoundingMode.HALF_UP);
        }
    }

    private BigDecimal calculateReturnPercentage(BigDecimal startPrice, BigDecimal endPrice) {
        if (startPrice == null || endPrice == null || startPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }

        return endPrice.subtract(startPrice)
                .divide(startPrice, 6, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private void ensurePortfolioExists(Long portfolioId) {
        if (!portfolioRepository.existsById(portfolioId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Portfolio not found: " + portfolioId);
        }
    }

    private record HoldingMetrics(
            Long holdingId,
            Long instrumentId,
            String ticker,
            String instrumentName,
            BigDecimal quantity,
            BigDecimal currentPrice,
            BigDecimal currentValue,
            BigDecimal rangeReturnPercentage,
            BigDecimal totalReturnPercentage,
            BigDecimal basePrice
    ) {
    }

    private enum PerformanceRange {
        ONE_DAY("1D") {
            @Override
            LocalDate startDate(LocalDate endDate) {
                return endDate.minusDays(1);
            }
        },
        ONE_WEEK("1W") {
            @Override
            LocalDate startDate(LocalDate endDate) {
                return endDate.minusWeeks(1);
            }
        },
        ONE_MONTH("1M") {
            @Override
            LocalDate startDate(LocalDate endDate) {
                return endDate.minusMonths(1);
            }
        },
        ONE_YEAR("1Y") {
            @Override
            LocalDate startDate(LocalDate endDate) {
                return endDate.minusYears(1);
            }
        };

        private final String apiValue;

        PerformanceRange(String apiValue) {
            this.apiValue = apiValue;
        }

        abstract LocalDate startDate(LocalDate endDate);

        String apiValue() {
            return apiValue;
        }

        static PerformanceRange from(String rawRange) {
            if (rawRange == null || rawRange.isBlank()) {
                return ONE_MONTH;
            }

            return switch (rawRange.trim().toUpperCase()) {
                case "1D", "DAY", "DAILY" -> ONE_DAY;
                case "1W", "WEEK", "WEEKLY" -> ONE_WEEK;
                case "1M", "MONTH", "MONTHLY" -> ONE_MONTH;
                case "1Y", "YEAR", "YEARLY" -> ONE_YEAR;
                default -> throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Unsupported range: " + rawRange + ". Use 1D, 1W, 1M or 1Y."
                );
            };
        }
    }
}