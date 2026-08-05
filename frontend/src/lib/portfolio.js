const allocationPalette = ['#0b1220', '#d0a234', '#466592', '#bcc4d2', '#7f8a9e']

export const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'performance', label: 'Performance' },
  { id: 'risk', label: 'Risk analysis' },
]

export const performanceFrames = [
  { id: 'day', label: 'Single Day', days: 1, sampleEvery: 1 },
  { id: 'week', label: '7 Days', days: 7, sampleEvery: 1 },
  { id: 'month', label: '1 Month', days: 30, sampleEvery: 4 },
  { id: 'twice', label: '2 Months', days: 60, sampleEvery: 7 },
  { id: 'trice', label: '3 Months', days: 90, sampleEvery: 10 },
  { id: 'quarterly', label: '6 Months', days: 180, sampleEvery: 15 },
  { id: 'year', label: '1 Year', days: 365, sampleEvery: 30 },
]

export function toNumber(value) {
  return Number(value ?? 0)
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

export function formatCompactCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

export function formatPercent(value, digits = 2) {
  return `${toNumber(value).toFixed(digits)}%`
}

export function formatQuantity(value) {
  return new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

export function formatDateLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'N/A'
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function buildHoldingsView(holdings, instruments) {
  const instrumentMap = new Map(instruments.map((instrument) => [instrument.instrumentId, instrument]))

  return holdings.map((holding) => {
    const instrument = instrumentMap.get(holding.instrumentId) ?? {}
    const quantity = toNumber(holding.quantity)
    const avgCost = toNumber(holding.avgCost)
    const currentPrice = toNumber(holding.currentPrice)
    const currentValue = toNumber(holding.currentValue)
    const invested = quantity * avgCost
    const gainLossAmount = currentValue - invested
    const gainLossPercentage = invested === 0 ? 0 : (gainLossAmount / invested) * 100

    return {
      ...holding,
      quantity,
      avgCost,
      currentPrice,
      currentValue,
      gainLossAmount,
      gainLossPercentage,
      name: instrument.name ?? holding.ticker,
      assetClass: instrument.assetClass ?? 'UNASSIGNED',
      exchange: instrument.exchange ?? 'N/A',
      currency: 'USD',
    }
  })
}

export function buildAssetClassAllocation(holdings, dashboard) {
  const totals = new Map()
  const totalValue = Math.max(toNumber(dashboard?.totalPortfolioValue), 0)

  for (const holding of holdings) {
    const label = holding.assetClass
    const nextValue = toNumber(holding.currentValue)
    totals.set(label, (totals.get(label) ?? 0) + nextValue)
  }

  if (totals.size === 0) {
    return [{ label: 'Cash', value: 1, percentage: 100, color: allocationPalette[3] }]
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, value], index) => ({
      label: label.charAt(0) + label.slice(1).toLowerCase(),
      value,
      percentage: totalValue === 0 ? 0 : (value / totalValue) * 100,
      color: allocationPalette[index % allocationPalette.length],
    }))
}

export function buildTickerTape(instruments, holdings) {
  if (holdings.length > 0) {
    return holdings.slice(0, 6).map((holding) => ({
      ticker: holding.ticker,
      currentPrice: holding.currentPrice,
      currency: holding.currency,
      change: holding.avgCost === 0 ? 0 : ((holding.currentPrice - holding.avgCost) / holding.avgCost) * 100,
    }))
  }

  return instruments.slice(0, 6).map((instrument) => ({
    ticker: instrument.ticker,
    currentPrice: instrument.currentPrice,
    currency: 'USD',
    change: 0,
  }))
}

export function buildPerformanceSeries(valueOverTime, frameId) {
  const frame = performanceFrames.find((candidate) => candidate.id === frameId) ?? performanceFrames[1]
  const points = valueOverTime.map((point) => ({
    date: point.date,
    value: toNumber(point.value),
  }))
  const sliced = points.slice(-frame.days)
  const sampled = sliced.filter((point, index) => index === sliced.length - 1 || index % frame.sampleEvery === 0)

  return sampled.map((point) => ({
    ...point,
    label: formatAxisDate(point.date, frame.id),
  }))
}

export function buildPerformerComparisonSeries(series, topGainPercentage = 0, weakGainPercentage = 0) {
  if (series.length === 0) {
    return []
  }

  const startValue = Math.max(toNumber(series[0].value), 1)
  const topGain = toNumber(topGainPercentage) / 100
  const weakGain = toNumber(weakGainPercentage) / 100
  const pointCount = Math.max(series.length - 1, 1)

  return series.map((point, index) => {
    const value = toNumber(point.value)
    const progress = index / pointCount
    const portfolioDrift = value / startValue - 1

    const topLine =
      startValue *
      (1 + portfolioDrift * 0.55 + topGain * progress * 0.45)
    const worstLine =
      startValue *
      (1 + portfolioDrift * 0.45 + weakGain * progress * 0.55)

    return {
      ...point,
      topLine: Number(topLine.toFixed(2)),
      worstLine: Number(worstLine.toFixed(2)),
    }
  })
}

export function mapFrameToPerformanceRange(frameId) {
  return (
    {
      week: '1W',
      day: '1D',
      month: '1M',
      twice: '1M',
      trice: '1M',
      quarterly: '1M',
      year: '1Y',
    }[frameId] ?? '1M'
  )
}

export function buildTopWorstSeriesFromApi(comparisonResponse, frameId) {
  const topSeries = comparisonResponse?.bestPerformerSeries ?? []
  const worstSeries = comparisonResponse?.worstPerformerSeries ?? []

  if (topSeries.length === 0 && worstSeries.length === 0) {
    return []
  }

  const byDate = new Map()

  for (const point of topSeries) {
    byDate.set(point.priceDate, {
      date: point.priceDate,
      topLine: toNumber(point.returnPercentage),
      worstLine: null,
    })
  }

  for (const point of worstSeries) {
    const existing = byDate.get(point.priceDate)
    if (existing) {
      existing.worstLine = toNumber(point.returnPercentage)
    } else {
      byDate.set(point.priceDate, {
        date: point.priceDate,
        topLine: null,
        worstLine: toNumber(point.returnPercentage),
      })
    }
  }

  return Array.from(byDate.values())
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((point) => ({
      ...point,
      label: formatAxisDate(point.date, frameId),
    }))
}

function formatAxisDate(value, frameId) {
  const date = new Date(value)
  if (frameId === 'week') {
    return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)
  }

  if (frameId === 'year') {
    return new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

export function findPerformanceExtremes(holdings) {
  if (holdings.length === 0) {
    return { top: null, weak: null }
  }

  const sorted = [...holdings].sort((left, right) => right.gainLossPercentage - left.gainLossPercentage)
  return {
    top: sorted[0],
    weak: sorted[sorted.length - 1],
  }
}

export function buildRiskOverview(dashboard, holdings, assetClassAllocation, riskApi = {}) {
  const valueSeries = (dashboard?.valueOverTime ?? []).map((point) => toNumber(point.value))
  const derivedVolatility = calculateVolatility(valueSeries)
  const derivedDrawdown = calculateDrawdown(valueSeries)
  const derivedConcentration = assetClassAllocation[0]?.percentage ?? 0
  const apiVolatility = toNumber(riskApi.portfolioVolatility) * 100
  const apiDrawdown = toNumber(riskApi.maxDrawdown) * 100
  const concentrationAlerts = Array.isArray(riskApi.concentrationAlerts) ? riskApi.concentrationAlerts : []
  const apiConcentration = concentrationAlerts.length
    ? Math.max(...concentrationAlerts.map((alert) => toNumber(alert.currentWeight) * 100))
    : 0

  const volatility = apiVolatility > 0 ? apiVolatility : derivedVolatility
  const drawdown = apiDrawdown < 0 ? apiDrawdown : derivedDrawdown
  const concentration = apiConcentration > 0 ? apiConcentration : derivedConcentration
  const liquidity = toNumber(dashboard?.cashAvailablePercentage)
  const assetClasses = assetClassAllocation.length
  const score = Math.max(
    8,
    Math.min(95, Math.round(concentration * 0.6 + volatility * 1.05 + Math.abs(drawdown) * 1.35 - liquidity * 0.35))
  )
  const level = score >= 67 ? 'Elevated' : score >= 40 ? 'Moderate' : 'Controlled'
  const topHolding = findPerformanceExtremes(holdings).top

  return {
    volatility,
    drawdown,
    concentration,
    score,
    level,
    assetClasses,
    observations: [
      {
        title: 'Concentration pressure',
        confidence: 'Rule-based signal',
        icon: 'alert',
        body: `${assetClassAllocation[0]?.label ?? 'Largest sleeve'} accounts for ${formatPercent(concentration, 1)} of portfolio value. ${concentrationAlerts.length > 0 ? `${concentrationAlerts.length} concentration alert(s) were raised by the backend.` : 'Review whether that weight still fits the client mandate.'}`,
      },
      {
        title: 'Return versus cushion',
        confidence: 'Calculated summary',
        icon: 'brain',
        body: `Cash buffer sits at ${formatPercent(liquidity, 1)} while total return is ${formatPercent(dashboard?.totalReturnPercentage, 1)}. The portfolio can absorb moderate swings without forcing a sale.`,
      },
      {
        title: 'Watch list candidate',
        confidence: 'Performance heuristic',
        icon: 'alert',
        body: topHolding
          ? `${topHolding.ticker} is the strongest contributor so far, but outsized winners often become the next concentration question in client reviews.`
          : 'Add more positions to unlock watch list recommendations.',
      },
    ],
  }
}

function calculateVolatility(values) {
  if (values.length < 3) {
    return 0
  }

  const returns = []
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1]
    const current = values[index]
    if (previous > 0) {
      returns.push((current - previous) / previous)
    }
  }

  if (returns.length === 0) {
    return 0
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

function calculateDrawdown(values) {
  if (values.length === 0) {
    return 0
  }

  let peak = values[0]
  let maxDrawdown = 0

  for (const value of values) {
    peak = Math.max(peak, value)
    if (peak > 0) {
      const drawdown = ((value - peak) / peak) * 100
      maxDrawdown = Math.min(maxDrawdown, drawdown)
    }
  }

  return maxDrawdown
}