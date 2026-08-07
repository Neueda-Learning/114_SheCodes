package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.HoldingService;
import com.example.Portfolio_Manager.dto.AddHoldingRequest;
import com.example.Portfolio_Manager.dto.HoldingResponse;
import com.example.Portfolio_Manager.dto.UpdateHoldingQuantityRequest;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/portfolio")
@Tag(
        name = "Holding Management APIs",
        description = "APIs for adding, fetching and deleting portfolio holdings"
)
public class HoldingController {


    private final HoldingService holdingService;


    public HoldingController(HoldingService holdingService) {
        this.holdingService = holdingService;
    }



    // GET ALL HOLDINGS
    @Operation(
            summary = "Get all holdings",
            description = "Fetch all holdings belonging to a specific portfolio ID"
    )
    @GetMapping("/{portfolioId}/holdings")
        public Page<HoldingResponse> getHoldings(
                        @PathVariable Long portfolioId,
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "5") int size) {

                return holdingService.getHoldings(portfolioId, page, size);
    }




    // ADD HOLDING
    @Operation(
            summary = "Add a new holding",
            description = "Adds a stock holding to the given portfolio"
    )
    @PostMapping("/{portfolioId}/holdings")
    public HoldingResponse addHolding(
            @PathVariable Long portfolioId,
            @Valid @RequestBody AddHoldingRequest request) {

        return holdingService.addHolding(
                portfolioId,
                request
        );
    }



        // UPDATE HOLDING QUANTITY
        @Operation(
                        summary = "Update holding quantity",
                        description = "Updates quantity for an existing holding"
        )
        @PatchMapping("/holdings/{holdingId}")
        public HoldingResponse updateHoldingQuantity(
                        @PathVariable Long holdingId,
                        @Valid @RequestBody UpdateHoldingQuantityRequest request) {

                return holdingService.updateHoldingQuantity(holdingId, request);
        }




    // DELETE HOLDING
    @Operation(
            summary = "Delete a holding",
            description = "Deletes an existing holding using holding ID"
    )
    @DeleteMapping("/holdings/{holdingId}")
    public void deleteHolding(
            @PathVariable Long holdingId) {

        holdingService.deleteHolding(holdingId);
    }
}