package com.example.Portfolio_Manager.Model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "holding")
public class Holding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long holdingId;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "portfolio_id", nullable = false)
    private Portfolio portfolio;


    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "instrument_id", nullable = false)
    private Instrument instrument;


    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal quantity;


    @Column(name = "avg_cost", nullable = false, precision = 18, scale = 4)
    private BigDecimal avgCost;


    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;


    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;



    // Constructors

    public Holding() {
    }



    // Getters and Setters


    public Long getHoldingId() {
        return holdingId;
    }


    public void setHoldingId(Long holdingId) {
        this.holdingId = holdingId;
    }


    public Portfolio getPortfolio() {
        return portfolio;
    }


    public void setPortfolio(Portfolio portfolio) {
        this.portfolio = portfolio;
    }


    public Instrument getInstrument() {
        return instrument;
    }


    public void setInstrument(Instrument instrument) {
        this.instrument = instrument;
    }


    public BigDecimal getQuantity() {
        return quantity;
    }


    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }


    public BigDecimal getAvgCost() {
        return avgCost;
    }


    public void setAvgCost(BigDecimal avgCost) {
        this.avgCost = avgCost;
    }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }


    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}