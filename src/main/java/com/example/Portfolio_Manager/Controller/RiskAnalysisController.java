
package com.example.Portfolio_Manager.Controller;

import com.example.Portfolio_Manager.Sevice.RiskAnalysisService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

        import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/risk")
public class RiskAnalysisController {

    private final RiskAnalysisService riskAnalysisService;

    public RiskAnalysisController(RiskAnalysisService riskAnalysisService) {
        this.riskAnalysisService = riskAnalysisService;
    }

    /** GET /api/risk/volatility?annualize=true */
    @GetMapping("/volatility")
    public ResponseEntity<RiskAnalysisService.VolatilityReport> getVolatility(
            @RequestParam(defaultValue = "true") boolean annualize) {
        return ResponseEntity.ok(riskAnalysisService.computePortfolioVolatilityReport(annualize));
    }

    /** GET /api/risk/max-drawdown */
    @GetMapping("/max-drawdown")
    public ResponseEntity<Map<String, Double>> getMaxDrawdown() {
        double drawdown = riskAnalysisService.computePortfolioMaxDrawdown();
        return ResponseEntity.ok(Map.of("maxDrawdown", drawdown));
    }

    /** GET /api/risk/concentration?threshold=0.25 */
    @GetMapping("/concentration")
    public ResponseEntity<List<RiskAnalysisService.ConcentrationAlert>> getConcentration(
            @RequestParam(defaultValue = "0.25") double threshold) {
        return ResponseEntity.ok(riskAnalysisService.checkConcentration(threshold));
    }

    @ExceptionHandler(RiskAnalysisService.InsufficientDataException.class)
    public ResponseEntity<Map<String, String>> handleInsufficientData(
            RiskAnalysisService.InsufficientDataException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(Map.of("error", ex.getMessage()));
    }
}