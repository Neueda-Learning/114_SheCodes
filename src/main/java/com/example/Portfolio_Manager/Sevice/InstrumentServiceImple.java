package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Repository.InstrumentRepository;
import com.example.Portfolio_Manager.dto.InstrumentResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InstrumentServiceImple implements InstrumentService {
    private final InstrumentRepository repository;

        private final YahooFinanceService yahooFinanceService;


    public InstrumentServiceImple(
                        InstrumentRepository repository,
                        YahooFinanceService yahooFinanceService){

        this.repository=repository;
                this.yahooFinanceService = yahooFinanceService;

    }
    @Override
    public List<InstrumentResponse> getAllInstruments() {
        return repository.findAll()
                .stream()
                                .sorted(java.util.Comparator.comparing(Instrument::getTicker))
                .map(this::convert)
                .toList();
    }
    private InstrumentResponse convert(
            Instrument instrument){


        InstrumentResponse response =
                new InstrumentResponse();


        response.setInstrumentId(
               instrument.getInstrumentId()
        );


        response.setName(
                instrument.getName()
        );


        response.setTicker(
                instrument.getTicker()
        );


        response.setAssetClass(
                instrument.getAssetClass().name()
        );


        response.setExchange(
                instrument.getExchange()
        );


        response.setCurrency(
                instrument.getCurrency()
        );


        response.setCurrentPrice(
                getCurrentPriceSafely(instrument.getTicker())
        );


        return response;

    }


        private java.math.BigDecimal getCurrentPriceSafely(String ticker) {
                try {
                        return yahooFinanceService.getCurrentPrice(ticker);
                } catch (RuntimeException exception) {
                        return null;
                }
        }
}
