package com.example.Portfolio_Manager.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public class UpdateHoldingQuantityRequest {

    @NotNull(message = "quantity is required")
    @Positive(message = "quantity must be greater than 0")
    private BigDecimal quantity;


    public BigDecimal getQuantity() {
        return quantity;
    }


    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }
}