// src/test/java/com/example/Portfolio_Manager/Sevice/RiskAnalysisServiceTest.java
package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.AssetClass;
import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.Price;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RiskAnalysisServiceTest {

    @Mock private Price priceRepository;
    @Mock private HoldingRepository holdingRepository;

    @InjectMocks private RiskAnalysisService riskAnalysisService;

    // ---------- computeDailyReturns ----------

    @Test
    void computeDailyReturns_correctFormula() {
        // Prices: 100, 110, 99 -> returns: +0.10, -0.10
        var prices = List.of(
                priceAt(BigDecimal.valueOf(100)),
                priceAt(BigDecimal.valueOf(110)),
                priceAt(BigDecimal.valueOf(99))
        );
        List<Double> returns = riskAnalysisService.computeDailyReturns(prices);

        assertEquals(2, returns.size());
        assertEquals(0.10, returns.get(0), 0.0001);
        assertEquals(-0.10, returns.get(1), 0.0001);
    }

    @Test
    void computeDailyReturns_emptyOrSinglePrice_returnsEmptyList() {
        assertTrue(riskAnalysisService.computeDailyReturns(List.of()).isEmpty());
        assertTrue(riskAnalysisService.computeDailyReturns(List.of(priceAt(BigDecimal.TEN))).isEmpty());
    }

    // ---------- computeVolatility ----------

    @Test
    void computeVolatility_matchesHandCalculatedStdDev() {
        // Returns: 0.02, -0.0098, 0.0396, -0.0190
        // Hand-calculated population std dev ≈ 0.0227 (unannualized)
        List<Double> returns = List.of(0.02, -0.0098, 0.0396, -0.0190);
        double result = riskAnalysisService.computeVolatility(returns, false);
        assertEquals(0.0227, result, 0.001);
    }

    @Test
    void computeVolatility_annualizedIsUnannualizedTimesSqrt252() {
        List<Double> returns = List.of(0.01, -0.01, 0.02, -0.02);
        double daily = riskAnalysisService.computeVolatility(returns, false);
        double annualized = riskAnalysisService.computeVolatility(returns, true);
        assertEquals(daily * Math.sqrt(252), annualized, 0.0001);
    }

    @Test
    void computeVolatility_zeroVarianceSeries_returnsZero() {
        // Price never changes -> every return is 0 -> volatility must be exactly 0, no divide-by-zero
        List<Double> returns = List.of(0.0, 0.0, 0.0, 0.0);
        assertEquals(0.0, riskAnalysisService.computeVolatility(returns, true));
    }

    @Test
    void computeVolatility_emptyReturns_returnsZeroNotException() {
        assertEquals(0.0, riskAnalysisService.computeVolatility(List.of(), true));
    }

    // ---------- computeInstrumentVolatility (insufficient data threshold) ----------

    @Test
    void computeInstrumentVolatility_fewerThan20Points_throwsInsufficientData() {
        List<com.example.Portfolio_Manager.Model.Price_History> shortHistory =
                List.of(priceAt(BigDecimal.valueOf(100)), priceAt(BigDecimal.valueOf(101)));

        when(priceRepository.findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                eq(1L), any(), any())).thenReturn(shortHistory);

        assertThrows(RiskAnalysisService.InsufficientDataException.class,
                () -> riskAnalysisService.computeInstrumentVolatility(1L, true));
    }

    // ---------- computeMaxDrawdown ----------

    @Test
    void computeMaxDrawdown_matchesHandCalculatedExample() {
        // Series: 100, 120, 90, 130, 80
        // Worst drawdown: from peak 130 down to 80 -> (80-130)/130 = -0.3846...
        List<Double> series = List.of(100.0, 120.0, 90.0, 130.0, 80.0);
        double result = riskAnalysisService.computeMaxDrawdown(series);
        assertEquals(-0.3846, result, 0.001);
    }

    @Test
    void computeMaxDrawdown_monotonicallyIncreasingSeries_isZero() {
        // Never dips below a prior peak -> no drawdown at all
        List<Double> series = List.of(100.0, 105.0, 110.0, 120.0);
        assertEquals(0.0, riskAnalysisService.computeMaxDrawdown(series));
    }

    @Test
    void computeMaxDrawdown_emptySeries_returnsZeroNotException() {
        assertEquals(0.0, riskAnalysisService.computeMaxDrawdown(List.of()));
    }

    // ---------- checkConcentration ----------

    @Test
    void checkConcentration_flagsOnlyHoldingsOverThreshold() {
        Instrument aapl = instrument("AAPL");
        Instrument bnd = instrument("BND");
        Holding aaplHolding = holding(aapl, BigDecimal.valueOf(100)); // will be 80% of portfolio
        Holding bndHolding = holding(bnd, BigDecimal.valueOf(25));   // 20%

        when(holdingRepository.findAll()).thenReturn(List.of(aaplHolding, bndHolding));
        when(priceRepository.findTopByInstrument_InstrumentIdOrderByPriceDateDesc(any()))
                .thenReturn(java.util.Optional.of(priceAt(BigDecimal.valueOf(1))));

        // quantities chosen so market values are 100 and 25 respectively via avgCost fallback
        var alerts = riskAnalysisService.checkConcentration(0.25);

        assertEquals(1, alerts.size());
        assertEquals("AAPL", alerts.get(0).ticker());
    }

    @Test
    void checkConcentration_emptyPortfolio_returnsEmptyListNoException() {
        when(holdingRepository.findAll()).thenReturn(List.of());
        assertTrue(riskAnalysisService.checkConcentration(0.25).isEmpty());
    }

    // ---------- test helpers ----------

    private com.example.Portfolio_Manager.Model.Price_History priceAt(BigDecimal close) {
        var ph = new com.example.Portfolio_Manager.Model.Price_History();
        ph.setClosePrice(close);
        return ph;
    }

    private Instrument instrument(String ticker) {
        Instrument i = new Instrument();
        i.setTicker(ticker);
        i.setAssetClass(AssetClass.STOCK);
        return i;
    }

    private Holding holding(Instrument instrument, BigDecimal quantity) {
        Holding h = new Holding();
        h.setInstrument(instrument);
        h.setQuantity(quantity);
        h.setAvgCost(BigDecimal.ONE);
        return h;
    }
}