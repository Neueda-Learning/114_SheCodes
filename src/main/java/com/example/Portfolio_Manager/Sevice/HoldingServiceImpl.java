package com.example.Portfolio_Manager.Sevice;


import com.example.Portfolio_Manager.dto.AddHoldingRequest;
import com.example.Portfolio_Manager.dto.HoldingResponse;
import com.example.Portfolio_Manager.Model.Holding;
import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Model.Portfolio;
import com.example.Portfolio_Manager.Repository.HoldingRepository;
import com.example.Portfolio_Manager.Repository.InstrumentRepository;
import com.example.Portfolio_Manager.Repository.PortfolioRepository;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;


import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;


@Service
public class HoldingServiceImpl implements HoldingService {


    private final HoldingRepository holdingRepository;

        private final PortfolioRepository portfolioRepository;

        private final InstrumentRepository instrumentRepository;

    private final YahooFinanceService yahooFinanceService;


    public HoldingServiceImpl(
            HoldingRepository holdingRepository,
                        PortfolioRepository portfolioRepository,
                        InstrumentRepository instrumentRepository,
            YahooFinanceService yahooFinanceService
    ) {

        this.holdingRepository = holdingRepository;
                this.portfolioRepository = portfolioRepository;
                this.instrumentRepository = instrumentRepository;
        this.yahooFinanceService = yahooFinanceService;

    }



    @Override
    public List<HoldingResponse> getHoldings(Long portfolioId) {


        List<Holding> holdings =
                holdingRepository.findByPortfolio_PortfolioId(portfolioId);


        return holdings.stream()
                .map(this::convertToResponse)
                .toList();

    }



    private HoldingResponse convertToResponse(Holding holding) {

                Instrument instrument = holding.getInstrument();
                String ticker = instrument.getTicker();
                String assetClass = instrument.getAssetClass() == null ? null : instrument.getAssetClass().name();

        BigDecimal currentPrice =
                                getCurrentPriceOrThrow(ticker);


        BigDecimal currentValue =
                currentPrice.multiply(
                        holding.getQuantity()
                );

        BigDecimal investedAmount =
                holding.getAvgCost().multiply(holding.getQuantity());

        BigDecimal gainLossAmount = currentValue.subtract(investedAmount);

        BigDecimal gainLossPercentage =
                investedAmount.compareTo(BigDecimal.ZERO) == 0
                        ? BigDecimal.ZERO
                        : gainLossAmount
                        .multiply(BigDecimal.valueOf(100))
                        .divide(investedAmount, 6, RoundingMode.HALF_UP);


        return new HoldingResponse(

                holding.getHoldingId(),

                holding.getPortfolio(). getPortfolioId(),

                holding.getInstrument().getInstrumentId(),

                ticker,

                holding.getQuantity(),

                holding.getAvgCost(),

                currentPrice,

                                currentValue,

                                instrument.getName(),

                                assetClass,

                                instrument.getExchange(),

                                instrument.getCurrency(),

                                investedAmount,

                                gainLossAmount,

                                gainLossPercentage
        );
    }




    @Override
    @Transactional
    public HoldingResponse addHolding(
            Long portfolioId,
            AddHoldingRequest request
    ) {

        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Portfolio not found: " + portfolioId
                ));

        if (request.getInstrumentId() == null || request.getInstrumentId() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "instrumentId must be greater than 0"
            );
        }

        Instrument instrument = instrumentRepository.findById(request.getInstrumentId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Instrument not found: " + request.getInstrumentId()
                ));

        BigDecimal currentPrice =
                getCurrentPriceOrThrow(instrument.getTicker());

        Holding holding = holdingRepository
                .findByPortfolio_PortfolioIdAndInstrument_InstrumentId(
                        portfolioId,
                        request.getInstrumentId()
                )
                .orElseGet(Holding::new);

        if (holding.getHoldingId() == null) {
            holding.setPortfolio(portfolio);
            holding.setInstrument(instrument);
            holding.setQuantity(request.getQuantity());
            holding.setAvgCost(currentPrice);
        } else {
            BigDecimal newQuantity = holding.getQuantity().add(request.getQuantity());
            BigDecimal existingCost = holding.getAvgCost().multiply(holding.getQuantity());
            BigDecimal incomingCost = currentPrice.multiply(request.getQuantity());
            BigDecimal weightedAverageCost = existingCost
                    .add(incomingCost)
                    .divide(newQuantity, 4, RoundingMode.HALF_UP);

            holding.setQuantity(newQuantity);
            holding.setAvgCost(weightedAverageCost);
        }

        Holding savedHolding = holdingRepository.save(holding);

        return convertToResponse(savedHolding);
    }




    @Override
    public void deleteHolding(Long holdingId) {

        holdingRepository.deleteById(holdingId);

    }


        private BigDecimal getCurrentPriceOrThrow(String ticker) {
                try {
                        return yahooFinanceService.getCurrentPrice(ticker);
                } catch (RuntimeException exception) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_GATEWAY,
                                        "Unable to fetch live market data for " + ticker,
                                        exception
                        );
                }
        }

}