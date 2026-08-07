package com.example.Portfolio_Manager.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class UpdateHoldingQuantityRequest {

    @NotNull(message = "quantity is required")
    @Min(value = 1, message = "quantity must be a whole number greater than 0")
    private Integer quantity;


    public Integer getQuantity() {
        return quantity;
    }


    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }
}