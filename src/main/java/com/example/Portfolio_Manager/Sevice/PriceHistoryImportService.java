
package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Model.Price_History;
import com.example.Portfolio_Manager.Repository.InstrumentRepository;
import com.example.Portfolio_Manager.Repository.Price;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Service
public class PriceHistoryImportService {

    private final YahooFinanceService yahooFinanceService;
    private final InstrumentRepository instrumentRepository;
    private final Price priceRepository;

    public PriceHistoryImportService(YahooFinanceService yahooFinanceService,
                                     InstrumentRepository instrumentRepository,
                                     Price priceRepository) {
        this.yahooFinanceService = yahooFinanceService;
        this.instrumentRepository = instrumentRepository;
        this.priceRepository = priceRepository;
    }

    /**
     * Fetches historical daily closes from Yahoo and saves any dates not
     * already in price_history. Safe to re-run — skips existing dates rather
     * than violating the UNIQUE(instrument_id, price_date) constraint.
     */
    public int importHistory(String symbol, int days) {
        String ticker = symbol.toUpperCase();

        Instrument instrument = instrumentRepository.findByTicker(ticker)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No instrument found for ticker " + ticker
                                + " — it must exist in the instrument table before importing prices for it"));

        Map<LocalDate, BigDecimal> history = yahooFinanceService.getHistoricalClosePrices(ticker, days);

        int savedCount = 0;
        for (Map.Entry<LocalDate, BigDecimal> entry : history.entrySet()) {
            LocalDate date = entry.getKey();
            BigDecimal close = entry.getValue();

            boolean alreadyExists = !priceRepository
                    .findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
                            instrument.getInstrumentId(), date, date)
                    .isEmpty();
            if (alreadyExists) continue;

            Price_History ph = new Price_History();
            ph.setInstrument(instrument);
            ph.setPriceDate(date);
            ph.setClosePrice(close);
            priceRepository.save(ph);
            savedCount++;
        }
        return savedCount;
    }
}