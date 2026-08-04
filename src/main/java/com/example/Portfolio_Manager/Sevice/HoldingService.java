package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.dto.AddHoldingRequest;
import com.example.Portfolio_Manager.dto.HoldingResponse;

import java.util.List;


public interface HoldingService {


    List<HoldingResponse> getHoldings(Long portfolioId);


    HoldingResponse addHolding(
            Long portfolioId,
            AddHoldingRequest request
    );


    void deleteHolding(Long holdingId);

}