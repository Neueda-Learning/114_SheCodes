package com.example.Portfolio_Manager.Repository;

import com.example.Portfolio_Manager.Model.PriceHistory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PriceHistoryRepository extends JpaRepository<PriceHistory, Long> {

    Optional<PriceHistory> findTopByInstrument_InstrumentIdOrderByPriceDateDesc(Long instrumentId);

    Optional<PriceHistory> findTopByInstrument_InstrumentIdAndPriceDateLessThanEqualOrderByPriceDateDesc(
            Long instrumentId,
            LocalDate priceDate
    );

    List<PriceHistory> findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
            Long instrumentId,
            LocalDate startDate,
            LocalDate endDate
    );
}