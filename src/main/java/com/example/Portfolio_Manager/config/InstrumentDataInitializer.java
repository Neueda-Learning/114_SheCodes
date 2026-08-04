package com.example.Portfolio_Manager.config;

import com.example.Portfolio_Manager.Model.AssetClass;
import com.example.Portfolio_Manager.Model.Instrument;
import com.example.Portfolio_Manager.Model.Portfolio;
import com.example.Portfolio_Manager.Repository.InstrumentRepository;
import com.example.Portfolio_Manager.Repository.PortfolioRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class InstrumentDataInitializer {

    @Bean
    CommandLineRunner seedDefaultPortfolio(PortfolioRepository portfolioRepository) {
        return args -> {
            if (portfolioRepository.count() > 0) {
                return;
            }

            Portfolio portfolio = new Portfolio();
            portfolio.setName("My Portfolio");
            portfolio.setBaseCurrency("USD");
            portfolioRepository.save(portfolio);
        };
    }

    @Bean
    CommandLineRunner seedInstruments(InstrumentRepository instrumentRepository) {
        return args -> {
            if (instrumentRepository.count() > 0) {
                return;
            }

            instrumentRepository.saveAll(List.of(
                    createInstrument("AAPL", "Apple Inc.", AssetClass.STOCK, "Technology", "USD", "NASDAQ"),
                    createInstrument("MSFT", "Microsoft Corporation", AssetClass.STOCK, "Technology", "USD", "NASDAQ"),
                    createInstrument("GOOGL", "Alphabet Inc.", AssetClass.STOCK, "Communication Services", "USD", "NASDAQ"),
                    createInstrument("AMZN", "Amazon.com, Inc.", AssetClass.STOCK, "Consumer Discretionary", "USD", "NASDAQ"),
                    createInstrument("NVDA", "NVIDIA Corporation", AssetClass.STOCK, "Technology", "USD", "NASDAQ"),
                    createInstrument("TSLA", "Tesla, Inc.", AssetClass.STOCK, "Consumer Discretionary", "USD", "NASDAQ"),
                    createInstrument("VTI", "Vanguard Total Stock Market ETF", AssetClass.ETF, "Broad Market", "USD", "NYSEARCA"),
                    createInstrument("BND", "Vanguard Total Bond Market ETF", AssetClass.BOND, "Fixed Income", "USD", "NASDAQ")
            ));
        };
    }

    private Instrument createInstrument(
            String ticker,
            String name,
            AssetClass assetClass,
            String sector,
            String currency,
            String exchange
    ) {
        Instrument instrument = new Instrument();
        instrument.setTicker(ticker);
        instrument.setName(name);
        instrument.setAssetClass(assetClass);
        instrument.setSector(sector);
        instrument.setCurrency(currency);
        instrument.setExchange(exchange);
        return instrument;
    }
}