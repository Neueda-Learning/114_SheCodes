const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'

async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    let message = `${response.status} ${response.statusText}`

    if (contentType.includes('application/json')) {
      const payload = await response.json()
      if (payload?.message) {
        message = payload.message
      } else if (payload?.error) {
        message = payload.error
      }
    } else {
      const text = await response.text()
      if (text) {
        message = text
      }
    }

    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? response.json() : response.text()
}

export async function getPortfolioSnapshot(portfolioId) {
  const [dashboard, holdings, instruments] = await Promise.all([
    apiRequest(`/portfolio/${portfolioId}/dashboard?days=365`),
    apiRequest(`/portfolio/${portfolioId}/holdings`),
    apiRequest('/instruments'),
  ])

  return { dashboard, holdings, instruments }
}

export function refreshPortfolioPrices(portfolioId, days = 365) {
  return apiRequest(`/portfolio/${portfolioId}/dashboard/refresh-prices?days=${days}`, {
    method: 'POST',
  })
}

export function addHolding(portfolioId, payload) {
  return apiRequest(`/portfolio/${portfolioId}/holdings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function deleteHolding(holdingId) {
  return apiRequest(`/portfolio/holdings/${holdingId}`, {
    method: 'DELETE',
  })
}

export function getPerformanceSummary(portfolioId, range = '1M') {
  return apiRequest(`/portfolio/${portfolioId}/performance/summary?range=${encodeURIComponent(range)}`)
}

export function getPerformanceHoldings(portfolioId, range = '1M') {
  return apiRequest(`/portfolio/${portfolioId}/performance/holdings?range=${encodeURIComponent(range)}`)
}

export function getPerformanceTopWorstHistory(portfolioId, range = '1M') {
  return apiRequest(`/portfolio/${portfolioId}/performance/top-worst-history?range=${encodeURIComponent(range)}`)
}

export function getRiskVolatility(annualize = true) {
  return apiRequest(`/risk/volatility?annualize=${annualize}`)
}

export function getRiskMaxDrawdown() {
  return apiRequest('/risk/max-drawdown')
}

export function getRiskConcentration(threshold = 0.25) {
  return apiRequest(`/risk/concentration?threshold=${threshold}`)
}