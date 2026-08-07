package com.example.Portfolio_Manager.Repository;

import com.example.Portfolio_Manager.Model.Price_History;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface Price extends JpaRepository<Price_History, Long> {

	List<Price_History> findByInstrument_InstrumentIdAndPriceDateBetweenOrderByPriceDateAsc(
			Long instrumentId,
			LocalDate startDate,
			LocalDate endDate
	);

	List<Price_History> findByInstrument_InstrumentIdOrderByPriceDateAsc(Long instrumentId);

	Optional<Price_History> findTopByInstrument_InstrumentIdOrderByPriceDateDesc(Long instrumentId);
}
