package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.Price_History;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.Price;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class RiskAnalysisService {

    private final Price priceRepository;
    private final HoldingRepository holdingRepository;

    // Trailing window for volatility/drawdown calcs — 252 ≈ trading days in a year.
    private static final int LOOKBACK_DAYS = 252;
    private static final int MIN_DATA_POINTS = 20;

    public RiskAnalysisService(Price priceRepository, HoldingRepository holdingRepository) {
        this.priceRepository = priceRepository;
        this.holdingRepository = holdingRepository;
    }

    // ---------------- Volatility ----------------

    public List<Double> computeDailyReturns(List<Price_History> prices) {
        List<Double> returns = new ArrayList<>();
        for (int i = 1; i < prices.size(); i++) {
            double prev = prices.get(i - 1).getClosePrice().doubleValue();
            double curr = prices.get(i).getClosePrice().doubleValue();
            if (prev != 0) returns.add((curr - prev) / prev);
        }
        return returns;
    }

    public double computeVolatility(List<Double> returns, boolean annualize) {
        if (returns.isEmpty()) return 0.0;
        double mean = returns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double variance = returns.stream().mapToDouble(r -> Math.pow(r - mean, 2)).sum() / returns.size();
        double stdDev = Math.sqrt(variance);
        return annualize ? stdDev * Math.sqrt(252) : stdDev;
    }

    /** Volatility for a single instrument, trailing LOOKBACK_DAYS window. */
    public double computeInstrumentVolatility(Long instrumentId, boolean annualize) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(LOOKBACK_DAYS);

        List<Price_History> prices = priceRepository
                .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(instrumentId, start, end);

        if (prices.size() < MIN_DATA_POINTS) {
            throw new InsufficientDataException(instrumentId, prices.size());
        }
        return computeVolatility(computeDailyReturns(prices), annualize);
    }

    /** Volatility per holding + one overall portfolio number, for the whole (single) portfolio. */
    public VolatilityReport computePortfolioVolatilityReport(boolean annualize) {
        List<Holding> holdings = holdingRepository.findAll();
        List<HoldingVolatility> perHolding = new ArrayList<>();

        for (Holding h : holdings) {
            try {
                double vol = computeInstrumentVolatility(h.getInstrument().getInstrumentId(), annualize);
                perHolding.add(new HoldingVolatility(h.getInstrument().getTicker(), vol, true));
            } catch (InsufficientDataException e) {
                // Surface the gap instead of silently skipping — the UI can show "insufficient data"
                perHolding.add(new HoldingVolatility(h.getInstrument().getTicker(), null, false));
            }
        }

        double portfolioVol = computePortfolioVolatility(annualize);
        return new VolatilityReport(perHolding, portfolioVol);
    }

    private double computePortfolioVolatility(boolean annualize) {
        List<Double> valueSeries = buildPortfolioValueSeries(LOOKBACK_DAYS);
        List<Double> returns = new ArrayList<>();
        for (int i = 1; i < valueSeries.size(); i++) {
            double prev = valueSeries.get(i - 1);
            double curr = valueSeries.get(i);
            if (prev != 0) returns.add((curr - prev) / prev);
        }
        return computeVolatility(returns, annualize);
    }

    // ---------------- Max drawdown ----------------

    public double computeMaxDrawdown(List<Double> valueSeries) {
        if (valueSeries.isEmpty()) return 0.0;
        double peak = valueSeries.get(0);
        double maxDrawdown = 0.0;
        for (double value : valueSeries) {
            if (value > peak) peak = value;
            double drawdown = (value - peak) / peak;
            if (drawdown < maxDrawdown) maxDrawdown = drawdown;
        }
        return maxDrawdown;
    }

    public double computePortfolioMaxDrawdown() {
        return computeMaxDrawdown(buildPortfolioValueSeries(LOOKBACK_DAYS));
    }

    // ---------------- Concentration ----------------

    public List<ConcentrationAlert> checkConcentration(double thresholdPct) {
        List<Holding> holdings = holdingRepository.findAll();
        double totalValue = holdings.stream().mapToDouble(this::currentMarketValue).sum();

        List<ConcentrationAlert> alerts = new ArrayList<>();
        if (totalValue == 0) return alerts;

        for (Holding h : holdings) {
            double weight = currentMarketValue(h) / totalValue;
            if (weight > thresholdPct) {
                alerts.add(new ConcentrationAlert(h.getInstrument().getTicker(), weight, thresholdPct));
            }
        }
        return alerts;
    }

    // ---------------- Helpers ----------------

    private double currentMarketValue(Holding holding) {
        BigDecimal latestPrice = priceRepository
                .findTopByInstrument_InstrumentIdOrderByPriceDateDesc(holding.getInstrument().getInstrumentId())
                .map(Price_History::getClosePrice)
                .orElse(holding.getAvgCost());
        return holding.getQuantity().doubleValue() * latestPrice.doubleValue();
    }

    /**
     * BEGINNER-TIER SIMPLIFICATION: applies today's holding quantities across
     * historical prices rather than replaying actual past holdings via the
     * transaction ledger. Swap for Member 2's real value-history logic later —
     * only this method needs to change.
     */
    private List<Double> buildPortfolioValueSeries(int lookbackDays) {
        List<Holding> holdings = holdingRepository.findAll();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(lookbackDays);

        List<Double> valueSeries = new ArrayList<>();
        for (int i = 0; i <= lookbackDays; i++) {
            LocalDate date = start.plusDays(i);
            double dayValue = 0.0;
            for (Holding h : holdings) {
                BigDecimal priceOnDate = priceRepository
                        .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                                h.getInstrument().getInstrumentId(), date, date)
                        .stream().findFirst()
                        .map(Price_History::getClosePrice)
                        .orElse(null);
                if (priceOnDate != null) {
                    dayValue += h.getQuantity().doubleValue() * priceOnDate.doubleValue();
                }
            }
            if (dayValue > 0) valueSeries.add(dayValue);
        }
        return valueSeries;
    }

    // ---------------- DTOs / records ----------------

    public record HoldingVolatility(String ticker, Double volatility, boolean sufficientData) {}
    public record VolatilityReport(List<HoldingVolatility> holdings, double portfolioVolatility) {}
    public record ConcentrationAlert(String ticker, double currentWeight, double threshold) {}

    public static class InsufficientDataException extends RuntimeException {
        public InsufficientDataException(Long instrumentId, int pointsFound) {
            super("Not enough price history for instrument " + instrumentId
                    + " to compute reliable volatility (found " + pointsFound + " points, need " + MIN_DATA_POINTS + "+)");
        }
    }
}