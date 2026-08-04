package com.example.Portfolio_Manager.Repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.Portfolio_Manager.Model.Instrument;

public interface InstrumentRepository extends JpaRepository<Instrument,Long> {

}
