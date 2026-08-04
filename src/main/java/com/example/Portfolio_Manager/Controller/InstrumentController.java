package com.example.Portfolio_Manager.Controller;


import com.example.Portfolio_Manager.Sevice.InstrumentService;
import com.example.Portfolio_Manager.dto.InstrumentResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


import java.util.List;


@RestController
@RequestMapping("/api/instruments")
@Tag(
        name = "Instrument Management APIs",
        description = "APIs for fetching available stocks/instruments"
)
public class InstrumentController {


    private final InstrumentService service;


    public InstrumentController(
            InstrumentService service) {

        this.service = service;
    }



    @Operation(
            summary = "Get all instruments",
            description = "Fetches all available instruments with their details like ticker, name, sector and exchange"
    )
    @GetMapping
    public List<InstrumentResponse> getAll() {

        return service.getAllInstruments();

    }
}