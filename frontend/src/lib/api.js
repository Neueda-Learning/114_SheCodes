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
  const [dashboard, holdingsResponse, instruments] = await Promise.all([
    apiRequest(`/portfolio/${portfolioId}/dashboard?days=365`),
    getHoldingsPage(portfolioId, 0, 1000),
    apiRequest('/instruments'),
  ])

  const holdings = holdingsResponse.content

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

export function updateHoldingQuantity(holdingId, payload) {
  return apiRequest(`/portfolio/holdings/${holdingId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getHoldingsPage(portfolioId, page = 0, size = 10) {
  return apiRequest(`/portfolio/${portfolioId}/holdings?page=${page}&size=${size}`).then(normalizeHoldingsPage)
}

function normalizeHoldingsPage(response) {
  if (Array.isArray(response)) {
    return {
      content: response,
      totalPages: 1,
      totalElements: response.length,
      number: 0,
      size: response.length,
    }
  }

  const fallbackContent = Array.isArray(response?.data?.content)
    ? response.data.content
    : Array.isArray(response?.content)
      ? response.content
      : []

  return {
    content: fallbackContent,
    totalPages: Number(response?.totalPages ?? response?.data?.totalPages ?? 1),
    totalElements: Number(response?.totalElements ?? response?.data?.totalElements ?? fallbackContent.length),
    number: Number(response?.number ?? response?.data?.number ?? 0),
    size: Number(response?.size ?? response?.data?.size ?? fallbackContent.length),
  }
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

export function getPortfolioSummaryExport(portfolioId, range = '1M', days = 365, threshold = 0.25) {
  return apiRequest(
    `/portfolio/${portfolioId}/dashboard/export-summary?range=${encodeURIComponent(range)}&days=${days}&threshold=${threshold}`
  )
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

export function getExchangeRate(from, to) {
  return apiRequest(`/market/price/${encodeURIComponent(`${from}${to}=X`)}`).then(
    (data) => Number(data?.currentPrice ?? 0)
  )
}