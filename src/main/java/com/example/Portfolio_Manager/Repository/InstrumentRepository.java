package com.example.Portfolio_Manager.Repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.Portfolio_Manager.Model.Instrument;

import java.util.Optional;

public interface InstrumentRepository extends JpaRepository<Instrument, Long> {

    Optional<Instrument> findByTicker(String ticker);
}