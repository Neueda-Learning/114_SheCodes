package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.dto.AddHoldingRequest;
import com.example.Portfolio_Manager.dto.HoldingResponse;
import com.example.Portfolio_Manager.dto.UpdateHoldingQuantityRequest;
import org.springframework.data.domain.Page;

import java.util.List;


public interface HoldingService {


    Page<HoldingResponse> getHoldings(Long portfolioId, int page, int size);


    HoldingResponse addHolding(
            Long portfolioId,
            AddHoldingRequest request
    );


        HoldingResponse updateHoldingQuantity(
            Long holdingId,
            UpdateHoldingQuantityRequest request
        );


    void deleteHolding(Long holdingId);

}