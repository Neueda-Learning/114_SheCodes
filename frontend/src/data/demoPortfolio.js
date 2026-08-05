function buildDemoSeries() {
  const endDate = new Date()
  const points = []

  for (let day = 364; day >= 0; day -= 1) {
    const currentDate = new Date(endDate)
    currentDate.setDate(endDate.getDate() - day)
    const index = 364 - day
    const value =
      144500 +
      index * 118 +
      Math.sin(index / 18) * 10400 +
      Math.cos(index / 9) * 3600 +
      Math.sin(index / 40) * 7200

    points.push({
      date: currentDate.toISOString().slice(0, 10),
      value: Number(value.toFixed(2)),
    })
  }

  return points
}

const instruments = [
  { instrumentId: 1, ticker: 'AAPL', name: 'Apple Inc.', assetClass: 'STOCK', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 214.1 },
  { instrumentId: 2, ticker: 'MSFT', name: 'Microsoft Corp.', assetClass: 'STOCK', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 598.5 },
  { instrumentId: 3, ticker: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'STOCK', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 112.3 },
  { instrumentId: 4, ticker: 'GOOG', name: 'Alphabet Inc.', assetClass: 'STOCK', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 171.4 },
  { instrumentId: 5, ticker: 'TSLA', name: 'Tesla Inc.', assetClass: 'STOCK', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 246.9 },
  { instrumentId: 6, ticker: 'VTI', name: 'Vanguard Total Market', assetClass: 'ETF', exchange: 'NYSEARCA', currency: 'EUR', currentPrice: 255.22 },
  { instrumentId: 7, ticker: 'BND', name: 'Vanguard Total Bond', assetClass: 'BOND', exchange: 'NASDAQ', currency: 'EUR', currentPrice: 71.9 },
  { instrumentId: 8, ticker: 'CASH', name: 'Cash Equivalent', assetClass: 'CASH', exchange: 'Internal', currency: 'EUR', currentPrice: 9840 },
]

const holdings = [
  { holdingId: 101, portfolioId: 1, instrumentId: 1, ticker: 'AAPL', quantity: 40, avgCost: 165.2, currentPrice: 214.1, currentValue: 8564 },
  { holdingId: 102, portfolioId: 1, instrumentId: 2, ticker: 'MSFT', quantity: 22, avgCost: 510, currentPrice: 598.5, currentValue: 13167 },
  { holdingId: 103, portfolioId: 1, instrumentId: 3, ticker: 'NVDA', quantity: 15, avgCost: 68.4, currentPrice: 112.3, currentValue: 1684.5 },
  { holdingId: 104, portfolioId: 1, instrumentId: 4, ticker: 'GOOG', quantity: 12, avgCost: 128, currentPrice: 171.4, currentValue: 2056.8 },
  { holdingId: 105, portfolioId: 1, instrumentId: 5, ticker: 'TSLA', quantity: 8, avgCost: 219.6, currentPrice: 246.9, currentValue: 1975.2 },
  { holdingId: 106, portfolioId: 1, instrumentId: 6, ticker: 'VTI', quantity: 30, avgCost: 220.1, currentPrice: 255.22, currentValue: 7656.6 },
  { holdingId: 107, portfolioId: 1, instrumentId: 7, ticker: 'BND', quantity: 60, avgCost: 74.2, currentPrice: 71.9, currentValue: 4314 },
  { holdingId: 108, portfolioId: 1, instrumentId: 8, ticker: 'CASH', quantity: 1, avgCost: 9840, currentPrice: 9840, currentValue: 9840 },
]

const valueOverTime = buildDemoSeries()
const totalPortfolioValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0)
const totalInvestedAmount = holdings.reduce((sum, holding) => sum + holding.avgCost * holding.quantity, 0)
const totalReturnAmount = totalPortfolioValue - totalInvestedAmount
const dayReturnAmount = valueOverTime.at(-1).value - valueOverTime.at(-2).value
const totalReturnPercentage = (totalReturnAmount / totalInvestedAmount) * 100
const dayReturnPercentage = (dayReturnAmount / valueOverTime.at(-2).value) * 100
const sectorTotals = [
  ['Technology', 23415.5],
  ['Broad Market', 7656.6],
  ['Fixed Income', 4314],
  ['Cash', 9840],
]
const sectorAllocation = sectorTotals.map(([label, value]) => ({
  label,
  value,
  percentage: (value / totalPortfolioValue) * 100,
}))

export const demoSnapshot = {
  dashboard: {
    asOf: new Date().toISOString(),
    baseCurrency: 'EUR',
    totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
    totalInvestedAmount: Number(totalInvestedAmount.toFixed(2)),
    totalReturnAmount: Number(totalReturnAmount.toFixed(2)),
    totalReturnPercentage: Number(totalReturnPercentage.toFixed(2)),
    investedPercentage: Number(((totalInvestedAmount / totalPortfolioValue) * 100).toFixed(2)),
    holdingsCount: holdings.length,
    totalAssetsCount: holdings.length,
    totalQuantity: Number(holdings.reduce((sum, holding) => sum + holding.quantity, 0).toFixed(2)),
    stockCount: 5,
    etfCount: 1,
    bondCount: 1,
    cashInstrumentCount: 1,
    cashAvailable: 9840,
    cashAvailablePercentage: Number(((9840 / totalPortfolioValue) * 100).toFixed(2)),
    livePriceFetchStatus: 'DEMO',
    stalePriceCount: 0,
    dayReturnAmount: Number(dayReturnAmount.toFixed(2)),
    dayReturnPercentage: Number(dayReturnPercentage.toFixed(2)),
    valueOverTime,
    sectorAllocation,
  },
  holdings,
  instruments,
}