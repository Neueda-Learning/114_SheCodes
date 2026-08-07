package com.example.Portfolio_Manager.Sevice;

import com.example.Portfolio_Manager.dto.DashboardResponse;

import java.util.Map;

public interface PortfolioAnalyticsService {

    DashboardResponse getDashboard(Long portfolioId, int days);

    Map<String, Integer> refreshPriceHistory(Long portfolioId, int days);
}
