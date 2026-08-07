package com.example.Portfolio_Manager.Model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "portfolio")
public class Portfolio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "portfolio_id")
    private Long portfolioId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "base_currency", nullable = false, length = 3)
    private String baseCurrency;


    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;


    public Long getPortfolioId() {
        return portfolioId;
    }


    public void setPortfolioId(Long portfolioId) {
        this.portfolioId = portfolioId;
    }


    public String getName() {
        return name;
    }


    public void setName(String name) {
        this.name = name;
    }


    public String getBaseCurrency() {
        return baseCurrency;
    }


    public void setBaseCurrency(String baseCurrency) {
        this.baseCurrency = baseCurrency;
    }


    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}