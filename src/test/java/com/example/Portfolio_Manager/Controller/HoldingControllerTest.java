package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.HoldingService;
import com.example.Portfolio_Manager.dto.HoldingResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
class HoldingControllerTest {

    @Mock
    private HoldingService holdingService;

    @InjectMocks
    private HoldingController holdingController;

    @Test
    void getHoldingsUsesDefaultPagination() throws Exception {
        HoldingResponse response = sampleResponse();
        Page<HoldingResponse> page = new PageImpl<>(List.of(response), PageRequest.of(0, 5), 1);

        when(holdingService.getHoldings(1L, 0, 5)).thenReturn(page);

        Page<HoldingResponse> result = holdingController.getHoldings(1L, 0, 5);

        assertEquals(1, result.getTotalElements());
        assertEquals("AAPL", result.getContent().getFirst().ticker());
        verify(holdingService).getHoldings(1L, 0, 5);
    }

    @Test
    void updateHoldingQuantityReturnsUpdatedHolding() throws Exception {
        HoldingResponse response = sampleResponse();
        when(holdingService.updateHoldingQuantity(any(), any())).thenReturn(response);

        HoldingResponse result = holdingController.updateHoldingQuantity(50L, new com.example.Portfolio_Manager.dto.UpdateHoldingQuantityRequest());

        assertEquals(50L, result.holdingId());
        assertEquals("AAPL", result.ticker());
        verify(holdingService).updateHoldingQuantity(any(), any());
    }

    private HoldingResponse sampleResponse() {
        return new HoldingResponse(
                50L,
                1L,
                11L,
                "AAPL",
                new BigDecimal("2"),
                new BigDecimal("150.0000"),
                new BigDecimal("200.00"),
                new BigDecimal("400.00"),
                "Apple Inc.",
                "STOCK",
                "NASDAQ",
                "USD",
                new BigDecimal("300.0000"),
                new BigDecimal("100.0000"),
                new BigDecimal("33.333333")
        );
    }
}