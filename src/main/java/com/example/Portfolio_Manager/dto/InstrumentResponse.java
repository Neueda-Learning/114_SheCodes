package com.example.Portfolio_Manager.dto;

import java.math.BigDecimal;

public class InstrumentResponse {


    private Long instrumentId;

    private String name;

    private String ticker;

    private String assetClass;

    private String exchange;

    private String currency;

    private BigDecimal currentPrice;


    public Long getInstrumentId() {
        return instrumentId;
    }


    public void setInstrumentId(Long instrumentId) {
        this.instrumentId = instrumentId;
    }


    public String getName() {
        return name;
    }


    public void setName(String name) {
        this.name = name;
    }


    public String getTicker() {
        return ticker;
    }


    public void setTicker(String ticker) {
        this.ticker = ticker;
    }


    public String getAssetClass() {
        return assetClass;
    }


    public void setAssetClass(String assetClass) {
        this.assetClass = assetClass;
    }


    public String getExchange() {
        return exchange;
    }


    public void setExchange(String exchange) {
        this.exchange = exchange;
    }


    public String getCurrency() {
        return currency;
    }


    public void setCurrency(String currency) {
        this.currency = currency;
    }


    public BigDecimal getCurrentPrice() {
        return currentPrice;
    }


    public void setCurrentPrice(BigDecimal currentPrice) {
        this.currentPrice = currentPrice;
    }

}
