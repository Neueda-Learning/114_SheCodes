package com.example.Portfolio_Manager.Repository;


import com.example.Portfolio_Manager.Model.Holding;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


public interface HoldingRepository
        extends JpaRepository<Holding, Long> {


    List<Holding> findByPortfolio_PortfolioId(Long portfolioId);


        Page<Holding> findByPortfolio_PortfolioId(Long portfolioId, Pageable pageable);


    java.util.Optional<Holding> findByPortfolio_PortfolioIdAndInstrument_InstrumentId(
            Long portfolioId,
            Long instrumentId
    );

}