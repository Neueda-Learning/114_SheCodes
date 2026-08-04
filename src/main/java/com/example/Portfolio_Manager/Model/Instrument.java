package com.example.Portfolio_Manager.Model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "instrument")
public class Instrument {


    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "instrument_id")
    private Long instrumentId;


    @Column(nullable = false, unique = true, length = 15)
    private String ticker;


    @Column(nullable = false, length = 150)
    private String name;


    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", nullable = false)
    private AssetClass assetClass;


    @Column(length = 100)
    private String sector;


    @Column(nullable = false, length = 3)
    private String currency;


    @Column(length = 50)
    private String exchange;


    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;


    public void setInstrumentId(Long instrumentId) {
        this.instrumentId = instrumentId;
    }

    public void setTicker(String ticker) {
        this.ticker = ticker;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setAssetClass(AssetClass assetClass) {
        this.assetClass = assetClass;
    }

    public void setSector(String sector) {
        this.sector = sector;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public Long getInstrumentId() {
        return instrumentId;
    }

    public String getTicker() {
        return ticker;
    }

    public String getName() {
        return name;
    }

    public AssetClass getAssetClass() {
        return assetClass;
    }

    public String getSector() {
        return sector;
    }

    public String getCurrency() {
        return currency;
    }

    public String getExchange() {
        return exchange;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
