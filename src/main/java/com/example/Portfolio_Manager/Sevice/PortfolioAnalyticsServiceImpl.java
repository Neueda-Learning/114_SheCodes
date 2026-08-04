package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.AssetClass;
import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Model.Portfolio;
import com.example.Portfolio_Manager.Model.Price_History;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.PortfolioRepository;
import com.example.Portfolio_Manager.Repository.Price;
import com.example.Portfolio_Manager.dto.DashboardResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

@Service
public class PortfolioAnalyticsServiceImpl implements PortfolioAnalyticsService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final HoldingRepository holdingRepository;
    private final PortfolioRepository portfolioRepository;
    private final Price priceRepository;
    private final YahooFinanceService yahooFinanceService;

    public PortfolioAnalyticsServiceImpl(
            HoldingRepository holdingRepository,
            PortfolioRepository portfolioRepository,
            Price priceRepository,
            YahooFinanceService yahooFinanceService
    ) {
        this.holdingRepository = holdingRepository;
        this.portfolioRepository = portfolioRepository;
        this.priceRepository = priceRepository;
        this.yahooFinanceService = yahooFinanceService;
    }

    @Override
    public DashboardResponse getDashboard(Long portfolioId, int days) {
        Portfolio portfolio = validatePortfolioExists(portfolioId);
        int normalizedDays = Math.max(days, 2);
        List<Holding> holdings = holdingRepository.findByPortfolio_PortfolioId(portfolioId);

        BigDecimal totalValue = BigDecimal.ZERO;
        BigDecimal totalCost = BigDecimal.ZERO;
        BigDecimal cashAvailable = BigDecimal.ZERO;
        BigDecimal totalQuantity = BigDecimal.ZERO;
        int stalePriceCount = 0;
        int stockCount = 0;
        int etfCount = 0;
        int bondCount = 0;
        int cashInstrumentCount = 0;

        Map<Long, BigDecimal> holdingCurrentValues = new HashMap<>();

        for (Holding holding : holdings) {
            PriceLookupResult currentPriceResult = getCurrentPriceWithStatus(holding.getInstrument());
            BigDecimal currentPrice = currentPriceResult.price();
            BigDecimal currentValue = currentPrice.multiply(holding.getQuantity());
            BigDecimal costBasis = holding.getAvgCost().multiply(holding.getQuantity());

            totalValue = totalValue.add(currentValue);
            totalCost = totalCost.add(costBasis);
            totalQuantity = totalQuantity.add(holding.getQuantity());
            holdingCurrentValues.put(holding.getHoldingId(), currentValue);

            if (!currentPriceResult.live()) {
                stalePriceCount++;
            }

            AssetClass assetClass = holding.getInstrument().getAssetClass();
            if (assetClass == AssetClass.STOCK) {
                stockCount++;
            } else if (assetClass == AssetClass.ETF) {
                etfCount++;
            } else if (assetClass == AssetClass.BOND) {
                bondCount++;
            } else if (assetClass == AssetClass.CASH) {
                cashInstrumentCount++;
            }

            if (assetClass == AssetClass.CASH) {
                cashAvailable = cashAvailable.add(currentValue);
            }
        }

        List<DashboardResponse.ValuePoint> series = buildPortfolioValueSeries(holdings, normalizedDays);

        BigDecimal dayReturnAmount = BigDecimal.ZERO;
        BigDecimal dayReturnPercentage = BigDecimal.ZERO;

        if (series.size() >= 2) {
            BigDecimal yesterdayValue = series.get(series.size() - 2).value();
            BigDecimal todayValue = series.get(series.size() - 1).value();
            dayReturnAmount = todayValue.subtract(yesterdayValue).setScale(2, RoundingMode.HALF_UP);
            dayReturnPercentage = percentage(dayReturnAmount, yesterdayValue);
        }

        BigDecimal totalReturnAmount = totalValue.subtract(totalCost).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalReturnPercentage = percentage(totalReturnAmount, totalCost);
        BigDecimal investedPercentage = percentage(totalCost, totalValue);
        BigDecimal cashAvailablePercentage = percentage(cashAvailable, totalValue);
        String livePriceFetchStatus = resolveLivePriceStatus(holdings.size(), stalePriceCount);

        List<DashboardResponse.AllocationSlice> allocation = buildSectorAllocation(holdings, holdingCurrentValues, totalValue);

        return new DashboardResponse(
            OffsetDateTime.now(),
            portfolio.getBaseCurrency(),
                totalValue.setScale(2, RoundingMode.HALF_UP),
            totalCost.setScale(2, RoundingMode.HALF_UP),
                totalReturnAmount,
                totalReturnPercentage,
            investedPercentage,
                holdings.size(),
            holdings.size(),
            totalQuantity.setScale(4, RoundingMode.HALF_UP),
            stockCount,
            etfCount,
            bondCount,
            cashInstrumentCount,
                cashAvailable.setScale(2, RoundingMode.HALF_UP),
            cashAvailablePercentage,
            livePriceFetchStatus,
            stalePriceCount,
                dayReturnAmount,
                dayReturnPercentage,
                series,
                allocation
        );
    }

    @Override
    @Transactional
    public Map<String, Integer> refreshPriceHistory(Long portfolioId, int days) {
        validatePortfolioExists(portfolioId);

        int normalizedDays = Math.max(days, 7);
        List<Holding> holdings = holdingRepository.findByPortfolio_PortfolioId(portfolioId);

        int inserted = 0;
        int instruments = 0;

        for (Holding holding : holdings) {
            instruments++;
            Instrument instrument = holding.getInstrument();
            Map<LocalDate, BigDecimal> prices = yahooFinanceService
                    .getHistoricalClosePrices(instrument.getTicker(), normalizedDays);

            for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                LocalDate priceDate = entry.getKey();
                BigDecimal closePrice = entry.getValue();

                boolean exists = priceRepository
                        .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                                instrument.getInstrumentId(),
                                priceDate,
                                priceDate
                        )
                        .stream()
                        .findAny()
                        .isPresent();

                if (exists) {
                    continue;
                }

                Price_History history = new Price_History();
                history.setInstrument(instrument);
                history.setPriceDate(priceDate);
                history.setClosePrice(closePrice);
                priceRepository.save(history);
                inserted++;
            }
        }

        Map<String, Integer> result = new LinkedHashMap<>();
        result.put("instrumentsProcessed", instruments);
        result.put("priceRowsInserted", inserted);
        return result;
    }

    private Portfolio validatePortfolioExists(Long portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Portfolio not found: " + portfolioId
                ));

        if (portfolio.getPortfolioId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Portfolio not found: " + portfolioId);
        }

        return portfolio;
    }

    private List<DashboardResponse.AllocationSlice> buildSectorAllocation(
            List<Holding> holdings,
            Map<Long, BigDecimal> holdingCurrentValues,
            BigDecimal totalValue
    ) {
        Map<String, BigDecimal> sectorTotals = new HashMap<>();

        for (Holding holding : holdings) {
            String sector = holding.getInstrument().getSector();
            if (sector == null || sector.isBlank()) {
                sector = "Unknown";
            }
            BigDecimal currentValue = holdingCurrentValues.getOrDefault(holding.getHoldingId(), BigDecimal.ZERO);
            sectorTotals.merge(sector, currentValue, BigDecimal::add);
        }

        return sectorTotals.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .map(entry -> new DashboardResponse.AllocationSlice(
                        entry.getKey(),
                        entry.getValue().setScale(2, RoundingMode.HALF_UP),
                        percentage(entry.getValue(), totalValue)
                ))
                .toList();
    }

    private List<DashboardResponse.ValuePoint> buildPortfolioValueSeries(List<Holding> holdings, int days) {
        if (holdings.isEmpty()) {
            return List.of();
        }

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1L);

        List<NavigableMap<LocalDate, BigDecimal>> priceSeries = holdings.stream()
                .map(holding -> getOrFetchPriceSeries(
                        holding.getInstrument(),
                        start,
                        end,
                        days
                ))
                .toList();

        List<DashboardResponse.ValuePoint> points = new ArrayList<>();

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            BigDecimal dailyTotal = BigDecimal.ZERO;

            for (int i = 0; i < holdings.size(); i++) {
                Holding holding = holdings.get(i);
                NavigableMap<LocalDate, BigDecimal> series = priceSeries.get(i);
                Map.Entry<LocalDate, BigDecimal> floor = series.floorEntry(date);
                if (floor == null) {
                    continue;
                }
                BigDecimal value = floor.getValue().multiply(holding.getQuantity());
                dailyTotal = dailyTotal.add(value);
            }

            points.add(new DashboardResponse.ValuePoint(date, dailyTotal.setScale(2, RoundingMode.HALF_UP)));
        }

        return points;
    }

    private NavigableMap<LocalDate, BigDecimal> getOrFetchPriceSeries(
            Instrument instrument,
            LocalDate start,
            LocalDate end,
            int days
    ) {
        List<Price_History> localHistory = priceRepository
                .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                        instrument.getInstrumentId(),
                        start,
                        end
                );

        if (localHistory.size() < Math.max(3, days / 3)) {
            Map<LocalDate, BigDecimal> remote = yahooFinanceService
                    .getHistoricalClosePrices(instrument.getTicker(), Math.max(days, 30));
            saveMissingHistory(instrument, remote);
            localHistory = priceRepository
                    .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                            instrument.getInstrumentId(),
                            start,
                            end
                    );
        }

        TreeMap<LocalDate, BigDecimal> result = new TreeMap<>();
        for (Price_History row : localHistory) {
            result.put(row.getPriceDate(), row.getClosePrice());
        }

        if (result.isEmpty()) {
            BigDecimal currentPrice = getCurrentPriceOrFallback(instrument);
            result.put(LocalDate.now(), currentPrice);
        }

        return result;
    }

    private void saveMissingHistory(Instrument instrument, Map<LocalDate, BigDecimal> remote) {
        if (remote.isEmpty()) {
            return;
        }

        List<Price_History> existing = priceRepository
                .findByInstrument_InstrumentIdOrderByPriceDateAsc(instrument.getInstrumentId());

        Map<LocalDate, Price_History> existingByDate = new HashMap<>();
        for (Price_History row : existing) {
            existingByDate.put(row.getPriceDate(), row);
        }

        for (Map.Entry<LocalDate, BigDecimal> entry : remote.entrySet()) {
            if (existingByDate.containsKey(entry.getKey())) {
                continue;
            }
            Price_History row = new Price_History();
            row.setInstrument(instrument);
            row.setPriceDate(entry.getKey());
            row.setClosePrice(entry.getValue());
            priceRepository.save(row);
        }
    }

    private BigDecimal getCurrentPriceOrFallback(Instrument instrument) {
        try {
            return yahooFinanceService.getCurrentPrice(instrument.getTicker());
        } catch (RuntimeException exception) {
            return priceRepository.findTopByInstrument_InstrumentIdOrderByPriceDateDesc(instrument.getInstrumentId())
                    .map(Price_History::getClosePrice)
                    .orElse(BigDecimal.ZERO);
        }
    }

    private BigDecimal percentage(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return numerator
                .divide(denominator, 8, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private PriceLookupResult getCurrentPriceWithStatus(Instrument instrument) {
        try {
            BigDecimal livePrice = yahooFinanceService.getCurrentPrice(instrument.getTicker());
            return new PriceLookupResult(livePrice, true);
        } catch (RuntimeException exception) {
            BigDecimal fallbackPrice = priceRepository
                    .findTopByInstrument_InstrumentIdOrderByPriceDateDesc(instrument.getInstrumentId())
                    .map(Price_History::getClosePrice)
                    .orElse(BigDecimal.ZERO);
            return new PriceLookupResult(fallbackPrice, false);
        }
    }

    private String resolveLivePriceStatus(int holdingsCount, int stalePriceCount) {
        if (holdingsCount == 0) {
            return "SUCCESS";
        }
        if (stalePriceCount == 0) {
            return "SUCCESS";
        }
        if (stalePriceCount == holdingsCount) {
            return "FAILED";
        }
        return "PARTIAL";
    }

    private record PriceLookupResult(BigDecimal price, boolean live) {
    }

}
