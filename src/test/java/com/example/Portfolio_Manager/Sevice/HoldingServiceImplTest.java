package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.AssetClass;
import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Model.Portfolio;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.InstrumentRepository;
import com.example.Portfolio_Manager.Repository.PortfolioRepository;
import com.example.Portfolio_Manager.dto.AddHoldingRequest;
import com.example.Portfolio_Manager.dto.HoldingResponse;
import com.example.Portfolio_Manager.dto.UpdateHoldingQuantityRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HoldingServiceImplTest {

    @Mock
    private HoldingRepository holdingRepository;

    @Mock
    private PortfolioRepository portfolioRepository;

    @Mock
    private InstrumentRepository instrumentRepository;

    @Mock
    private YahooFinanceService yahooFinanceService;

    @InjectMocks
    private HoldingServiceImpl holdingService;

    private Portfolio portfolio;
    private Instrument instrument;
    private Holding holding;

    @BeforeEach
    void setUp() {
        portfolio = new Portfolio();
        portfolio.setPortfolioId(1L);
        portfolio.setName("My Portfolio");
        portfolio.setBaseCurrency("USD");

        instrument = new Instrument();
        instrument.setInstrumentId(11L);
        instrument.setTicker("AAPL");
        instrument.setName("Apple Inc.");
        instrument.setAssetClass(AssetClass.STOCK);
        instrument.setCurrency("USD");
        instrument.setExchange("NASDAQ");

        holding = new Holding();
        holding.setHoldingId(50L);
        holding.setPortfolio(portfolio);
        holding.setInstrument(instrument);
        holding.setQuantity(new BigDecimal("2"));
        holding.setAvgCost(new BigDecimal("150.0000"));
    }

    @Test
    void getHoldingsReturnsPagedResponses() {
        when(portfolioRepository.existsById(1L)).thenReturn(true);
        when(holdingRepository.findByPortfolio_PortfolioId(eq(1L), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(holding)));
        when(yahooFinanceService.getCurrentPrice("AAPL")).thenReturn(new BigDecimal("200.00"));

        Page<HoldingResponse> result = holdingService.getHoldings(1L, 0, 5);

        assertEquals(1, result.getTotalElements());
        HoldingResponse response = result.getContent().getFirst();
        assertEquals("AAPL", response.ticker());
        assertEquals(new BigDecimal("400.00"), response.currentValue());
        assertEquals(new BigDecimal("300.0000"), response.investedAmount());
        assertEquals(new BigDecimal("100.0000"), response.gainLossAmount());
    }

    @Test
    void getHoldingsThrowsWhenPortfolioMissing() {
        when(portfolioRepository.existsById(1L)).thenReturn(false);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> holdingService.getHoldings(1L, 0, 5)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
    }

    @Test
    void addHoldingMergesExistingHoldingUsingWeightedAverage() {
        AddHoldingRequest request = new AddHoldingRequest();
        request.setInstrumentId(11L);
        request.setQuantity(new BigDecimal("2"));

        holding.setQuantity(new BigDecimal("3"));
        holding.setAvgCost(new BigDecimal("100.0000"));

        when(portfolioRepository.findById(1L)).thenReturn(Optional.of(portfolio));
        when(instrumentRepository.findById(11L)).thenReturn(Optional.of(instrument));
        when(holdingRepository.findByPortfolio_PortfolioIdAndInstrument_InstrumentId(1L, 11L))
                .thenReturn(Optional.of(holding));
        when(holdingRepository.save(any(Holding.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(yahooFinanceService.getCurrentPrice("AAPL")).thenReturn(new BigDecimal("160.00"));

        HoldingResponse response = holdingService.addHolding(1L, request);

        ArgumentCaptor<Holding> captor = ArgumentCaptor.forClass(Holding.class);
        verify(holdingRepository).save(captor.capture());
        Holding savedHolding = captor.getValue();

        assertEquals(new BigDecimal("5"), savedHolding.getQuantity());
        assertEquals(new BigDecimal("124.0000"), savedHolding.getAvgCost());
        assertEquals(new BigDecimal("5"), response.quantity());
    }

    @Test
    void updateHoldingQuantityUpdatesExistingHolding() {
        UpdateHoldingQuantityRequest request = new UpdateHoldingQuantityRequest();
        request.setQuantity(new BigDecimal("9"));

        when(holdingRepository.findById(50L)).thenReturn(Optional.of(holding));
        when(holdingRepository.save(any(Holding.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(yahooFinanceService.getCurrentPrice("AAPL")).thenReturn(new BigDecimal("200.00"));

        HoldingResponse response = holdingService.updateHoldingQuantity(50L, request);

        assertEquals(new BigDecimal("9"), response.quantity());
    }
}