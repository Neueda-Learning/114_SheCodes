import { useDeferredValue, useEffect, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  BriefcaseBusiness,
  CandlestickChart,
  Download,
  LoaderCircle,
  Pencil,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { demoSnapshot } from './data/demoPortfolio'
import {
  addHolding,
  deleteHolding,
  getExchangeRate,
  getHoldingsPage,
  getPerformanceHoldings,
  getPerformanceSummary,
  getPerformanceTopWorstHistory,
  getPortfolioSummaryExport,
  getPortfolioSnapshot,
  getRiskConcentration,
  getRiskMaxDrawdown,
  getRiskVolatility,
  refreshPortfolioPrices,
  updateHoldingQuantity,
} from './lib/api'
import {
  buildAssetClassAllocation,
  buildHoldingsView,
  buildPerformerComparisonSeries,
  buildPerformanceSeries,
  buildRiskOverview,
  buildTopWorstSeriesFromApi,
  buildTickerTape,
  findPerformanceExtremes,
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  formatPercent,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  mapFrameToPerformanceRange,
  performanceFrames,
  tabs,
  toNumber,
} from './lib/portfolio'

function parseCsvLine(line) {
  const values = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function parseHoldingsCsv(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one holding row.')
  }

  const headers = parseCsvLine(rows[0]).map((header) => header.toLowerCase().replace(/\s+/g, ''))
  const instrumentIdIndex = headers.findIndex((header) => header === 'instrumentid' || header === 'instrument')
  const tickerIndex = headers.findIndex((header) => header === 'ticker' || header === 'symbol')
  const quantityIndex = headers.findIndex((header) => header === 'quantity' || header === 'qty' || header === 'units')

  if (quantityIndex === -1) {
    throw new Error('CSV requires a quantity column (quantity/qty/units).')
  }

  if (instrumentIdIndex === -1 && tickerIndex === -1) {
    throw new Error('CSV requires either instrumentId/instrument or ticker/symbol column.')
  }

  return rows.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line)
    return {
      lineNumber: rowIndex + 2,
      instrumentIdRaw: instrumentIdIndex >= 0 ? values[instrumentIdIndex] : '',
      tickerRaw: tickerIndex >= 0 ? values[tickerIndex] : '',
      quantityRaw: values[quantityIndex],
    }
  })
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [performanceFrame, setPerformanceFrame] = useState('day')
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const portfolioId = Number(import.meta.env.VITE_PORTFOLIO_ID ?? 1)
  const deferredSearch = useDeferredValue(searchQuery)
  const [isTabPending, startTransition] = useTransition()
  const [portfolioState, setPortfolioState] = useState({
    status: 'loading',
    mode: 'demo',
    message: '',
    snapshot: demoSnapshot,
  })
  const [insightState, setInsightState] = useState({
    loading: false,
    error: '',
    performanceByFrame: {},
    risk: {},
  })
  const [actionState, setActionState] = useState({
    refreshing: false,
    deletingId: null,
    updatingId: null,
    importing: false,
    exporting: false,
    exportingSummary: false,
    error: '',
  })
  const [dashboardAction, setDashboardAction] = useState('import-holdings')
  const [toastState, setToastState] = useState({
    visible: false,
    message: '',
    type: 'success',
  })
  const toastTimeoutRef = useRef(null)
  const csvInputRef = useRef(null)
  const holdingsRequestRef = useRef(0)
  const [liveAnnouncement, setLiveAnnouncement] = useState('')
  const [formState, setFormState] = useState({
    instrumentId: '',
    quantity: '',
    submitting: false,
    error: '',
  })
  const [usdToInr, setUsdToInr] = useState(84.5)
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [fxRates, setFxRates] = useState({
    USD_INR: 84.5,
    INR_USD: 1 / 84.5,
  })
  const [holdingsPage, setHoldingsPage] = useState(1)
  const [holdingsPageSize, setHoldingsPageSize] = useState(10)
  const [holdingsPageState, setHoldingsPageState] = useState({
    items: [],
    totalPages: 1,
    totalItems: 0,
    loading: false,
  })

  function logCustomerAction(action, details = {}) {
    console.info('[customer-action]', action, {
      ...details,
      timestamp: new Date().toISOString(),
    })
  }

  function showToast(message, type = 'success') {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }

    setToastState({
      visible: true,
      message,
      type,
    })

    toastTimeoutRef.current = setTimeout(() => {
      setToastState((current) => ({
        ...current,
        visible: false,
      }))
      toastTimeoutRef.current = null
    }, 2800)
  }

  function mergeHoldingIntoSnapshot(updatedHolding) {
    setPortfolioState((current) => {
      const snapshot = current.snapshot
      if (!snapshot?.holdings) {
        return current
      }

      const nextHoldings = snapshot.holdings.map((holding) =>
        holding.holdingId === updatedHolding.holdingId ? { ...holding, ...updatedHolding } : holding
      )

      return {
        ...current,
        snapshot: {
          ...snapshot,
          holdings: nextHoldings,
        },
      }
    })
  }

  function mergeHoldingIntoVisiblePage(updatedHolding) {
    const instruments = portfolioState.snapshot?.instruments ?? []
    const updatedView = buildHoldingsView([updatedHolding], instruments)[0]
    if (!updatedView) {
      return
    }

    setHoldingsPageState((current) => ({
      ...current,
      items: current.items.map((holding) =>
        holding.holdingId === updatedHolding.holdingId ? { ...holding, ...updatedView } : holding
      ),
    }))
  }

  async function fetchInsights(frameId) {
    const range = mapFrameToPerformanceRange(frameId)
    const [summaryResult, holdingsResult, comparisonResult, volatilityResult, drawdownResult, concentrationResult] =
      await Promise.allSettled([
        getPerformanceSummary(portfolioId, range),
        getPerformanceHoldings(portfolioId, range),
        getPerformanceTopWorstHistory(portfolioId, range),
        getRiskVolatility(true),
        getRiskMaxDrawdown(),
        getRiskConcentration(0.25),
      ])

    const performance = {
      summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
      holdings: holdingsResult.status === 'fulfilled' ? holdingsResult.value : [],
      comparison: comparisonResult.status === 'fulfilled' ? comparisonResult.value : null,
    }

    const risk = {
      portfolioVolatility: volatilityResult.status === 'fulfilled' ? volatilityResult.value?.portfolioVolatility : null,
      maxDrawdown: drawdownResult.status === 'fulfilled' ? drawdownResult.value?.maxDrawdown : null,
      concentrationAlerts: concentrationResult.status === 'fulfilled' ? concentrationResult.value : [],
    }

    const performanceFailures = [summaryResult, holdingsResult, comparisonResult].filter(
      (result) => result.status === 'rejected'
    )

    const error =
      performanceFailures.length > 0
        ? 'Performance analytics endpoints were unavailable; showing partial analytics.'
        : ''

    return { performance, risk, error }
  }

  async function loadLiveSnapshot({ actionMessage = '', loadingStatus = 'loading' } = {}) {
    setPortfolioState((current) => ({
      ...current,
      status: loadingStatus,
      message: '',
    }))

    try {
      const snapshot = await getPortfolioSnapshot(portfolioId)
      logCustomerAction('snapshot_loaded', { mode: 'live', loadingStatus })
      setPortfolioState({
        status: 'ready',
        mode: 'live',
        message: '',
        snapshot,
      })

      if (actionMessage) {
        showToast(actionMessage, 'success')
        setActionState((current) => ({
          ...current,
          error: '',
        }))
      }

      return { ok: true, snapshot }
    } catch (error) {
      logCustomerAction('snapshot_fallback_demo', { reason: error.message })
      setPortfolioState({
        status: 'ready',
        mode: 'demo',
        message: error.message,
        snapshot: demoSnapshot,
      })
      setInsightState((current) => ({
        ...current,
        loading: false,
        error: '',
      }))
      return { ok: false }
    }
  }

  async function loadHoldingsPage(page = holdingsPage, size = holdingsPageSize) {
    const requestId = holdingsRequestRef.current + 1
    holdingsRequestRef.current = requestId

    setHoldingsPageState((current) => ({
      ...current,
      loading: true,
    }))

    try {
      const response = await getHoldingsPage(portfolioId, Math.max(page - 1, 0), size)
      if (requestId !== holdingsRequestRef.current) {
        return
      }

      const rawItems = Array.isArray(response?.content) ? response.content : []
      const instruments = portfolioState.snapshot?.instruments ?? []
      const items = buildHoldingsView(rawItems, instruments)
      const totalPages = Math.max(1, Number(response?.totalPages ?? 1))
      const totalItems = Math.max(0, Number(response?.totalElements ?? items.length))

      setHoldingsPageState({
        items,
        totalPages,
        totalItems,
        loading: false,
      })
    } catch (error) {
      if (requestId !== holdingsRequestRef.current) {
        return
      }

      setHoldingsPageState((current) => ({
        ...current,
        loading: false,
      }))
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
    }
  }

  async function refreshUsdInrRate() {
    try {
      const rate = await getExchangeRate('USD', 'INR')
      if (rate > 0) {
        setUsdToInr(rate)
        setFxRates((current) => ({
          ...current,
          USD_INR: rate,
          INR_USD: 1 / rate,
        }))
      }
    } catch {
      // Keep the last known FX rate if live fetch fails.
    }
  }

  function convertAmountForDisplay(value, baseCurrency = 'USD', targetCurrency = displayCurrency) {
    const amount = toNumber(value)
    const base = String(baseCurrency ?? 'USD').toUpperCase()
    const target = String(targetCurrency ?? 'USD').toUpperCase()

    if (base === target) {
      return amount
    }

    const directRate = toNumber(fxRates[`${base}_${target}`])
    if (directRate > 0) {
      return amount * directRate
    }

    const inverseRate = toNumber(fxRates[`${target}_${base}`])
    if (inverseRate > 0) {
      return amount / inverseRate
    }

    const baseToUsd = base === 'USD' ? 1 : toNumber(fxRates[`${base}_USD`])
    const usdToTarget = target === 'USD' ? 1 : toNumber(fxRates[`USD_${target}`])

    if (baseToUsd > 0 && usdToTarget > 0) {
      return amount * baseToUsd * usdToTarget
    }

    return amount
  }

  async function refreshDisplayFxRates(nextCurrency = displayCurrency, snapshotOverride = null) {
    const target = String(nextCurrency ?? 'USD').toUpperCase()
    const snapshotData = snapshotOverride ?? portfolioState.snapshot
    const sources = new Set(['USD', 'INR'])

    const dashboardCurrency = snapshotData?.dashboard?.baseCurrency
    if (dashboardCurrency) {
      sources.add(String(dashboardCurrency).toUpperCase())
    }

    for (const instrument of snapshotData?.instruments ?? []) {
      if (instrument?.currency) {
        sources.add(String(instrument.currency).toUpperCase())
      }
    }

    for (const holding of snapshotData?.holdings ?? []) {
      if (holding?.currency) {
        sources.add(String(holding.currency).toUpperCase())
      }
    }

    sources.add(target)

    const pairKeys = new Set()
    const pairs = []

    for (const base of sources) {
      if (base !== target) {
        const key = `${base}_${target}`
        if (!pairKeys.has(key)) {
          pairKeys.add(key)
          pairs.push([base, target])
        }
      }

      if (base !== 'USD') {
        const usdKey = `${base}_USD`
        if (!pairKeys.has(usdKey)) {
          pairKeys.add(usdKey)
          pairs.push([base, 'USD'])
        }
      }
    }

    if (target !== 'USD') {
      const usdTargetKey = `USD_${target}`
      if (!pairKeys.has(usdTargetKey)) {
        pairKeys.add(usdTargetKey)
        pairs.push(['USD', target])
      }
    }

    if (pairs.length === 0) {
      return
    }

    const results = await Promise.allSettled(
      pairs.map(async ([from, to]) => {
        const rate = await getExchangeRate(from, to)
        return { from, to, rate }
      })
    )

    setFxRates((current) => {
      const next = { ...current }

      for (const result of results) {
        if (result.status !== 'fulfilled') {
          continue
        }

        const { from, to, rate } = result.value
        const numericRate = toNumber(rate)
        if (numericRate <= 0) {
          continue
        }

        next[`${from}_${to}`] = numericRate
        next[`${to}_${from}`] = 1 / numericRate
      }

      const latestUsdInr = toNumber(next.USD_INR)
      if (latestUsdInr > 0) {
        setUsdToInr(latestUsdInr)
      }

      return next
    })
  }

  function formatDualCurrency(value, baseCurrency = 'USD') {
    const target = String(displayCurrency ?? 'USD').toUpperCase()
    const converted = convertAmountForDisplay(value, baseCurrency, target)

    return formatCurrency(converted, target, 1)
  }

  function formatDualSignedCurrency(value, baseCurrency = 'USD') {
    const target = String(displayCurrency ?? 'USD').toUpperCase()
    const converted = convertAmountForDisplay(value, baseCurrency, target)

    return formatSignedCurrency(converted, target, 1)
  }

  function formatCompactDisplayCurrency(value, baseCurrency = 'USD') {
    const target = String(displayCurrency ?? 'USD').toUpperCase()
    const converted = convertAmountForDisplay(value, baseCurrency, target)

    return formatCompactCurrency(converted, target, 1)
  }

  useEffect(() => {
    let active = true

    async function initialize() {
      await refreshUsdInrRate()
      const result = await loadLiveSnapshot({ loadingStatus: 'loading' })
      await refreshDisplayFxRates(displayCurrency, result.ok ? result.snapshot : demoSnapshot)
      if (!active || !result.ok) {
        return
      }

      setInsightState((current) => ({ ...current, loading: true, error: '' }))
      const insights = await fetchInsights(performanceFrame)
      if (!active) {
        return
      }

      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: insights.risk,
      }))
    }

    initialize()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    refreshUsdInrRate()
    refreshDisplayFxRates(displayCurrency)
    const timerId = setInterval(() => {
      refreshUsdInrRate()
      refreshDisplayFxRates(displayCurrency)
    }, 60 * 1000)

    return () => {
      clearInterval(timerId)
    }
  }, [displayCurrency, portfolioState.snapshot])

  useEffect(() => {
    if (portfolioState.mode !== 'live' || insightState.performanceByFrame[performanceFrame]) {
      return
    }

    let active = true

    async function loadFrameInsights() {
      setInsightState((current) => ({ ...current, loading: true, error: '' }))
      const insights = await fetchInsights(performanceFrame)
      if (!active) {
        return
      }

      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: {
          ...current.risk,
          ...insights.risk,
        },
      }))
    }

    loadFrameInsights()

    return () => {
      active = false
    }
  }, [performanceFrame, portfolioState.mode, insightState.performanceByFrame])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!formState.instrumentId && portfolioState.snapshot?.instruments?.length) {
      setFormState((current) => ({
        ...current,
        instrumentId: String(portfolioState.snapshot.instruments[0].instrumentId),
      }))
    }
  }, [formState.instrumentId, portfolioState.snapshot])

  async function handleRefreshPrices() {
    logCustomerAction('refresh_prices_clicked', { mode: portfolioState.mode })
    if (portfolioState.mode === 'demo') {
      setActionState((current) => ({
        ...current,
        refreshing: false,
        error: '',
      }))
      showToast('Refresh is disabled in presentation mode.', 'info')
      return
    }

    setActionState((current) => ({ ...current, refreshing: true, error: '' }))

    try {
      await refreshPortfolioPrices(portfolioId, 365)
      logCustomerAction('refresh_prices_request_sent', { portfolioId })
      const result = await loadLiveSnapshot({ actionMessage: 'Prices refreshed successfully.', loadingStatus: 'refreshing' })
      if (result.ok) {
        const insights = await fetchInsights(performanceFrame)
        setInsightState((current) => ({
          ...current,
          loading: false,
          error: insights.error,
          performanceByFrame: {
            ...current.performanceByFrame,
            [performanceFrame]: insights.performance,
          },
          risk: insights.risk,
        }))
      }
    } catch (error) {
      logCustomerAction('refresh_prices_failed', { reason: error.message })
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
    } finally {
      setActionState((current) => ({ ...current, refreshing: false }))
    }
  }

  async function handleAddHolding(event) {
    event.preventDefault()
    logCustomerAction('add_holding_submitted', {
      instrumentId: formState.instrumentId,
      quantity: formState.quantity,
      mode: portfolioState.mode,
    })

    if (portfolioState.mode === 'demo') {
      setFormState((current) => ({
        ...current,
        submitting: false,
        error: 'Add holding is disabled in presentation mode.',
      }))
      return
    }

    if (!formState.instrumentId || !formState.quantity) {
      logCustomerAction('add_holding_validation_failed', { reason: 'missing_fields' })
      setFormState((current) => ({
        ...current,
        error: 'Instrument and quantity are required.',
      }))
      return
    }

    setFormState((current) => ({
      ...current,
      submitting: true,
      error: '',
    }))

    try {
      await addHolding(portfolioId, {
        instrumentId: Number(formState.instrumentId),
        quantity: Number(formState.quantity),
      })
      logCustomerAction('add_holding_succeeded', {
        instrumentId: Number(formState.instrumentId),
        quantity: Number(formState.quantity),
      })
      await loadLiveSnapshot({ actionMessage: 'Holding added successfully.' })
      await loadHoldingsPage(holdingsPage, holdingsPageSize)
      const insights = await fetchInsights(performanceFrame)
      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: insights.risk,
      }))
      setFormState((current) => ({
        ...current,
        quantity: '',
      }))
      setShowAddForm(false)
      setLiveAnnouncement('Holding added successfully.')
    } catch (error) {
      logCustomerAction('add_holding_failed', { reason: error.message })
      setFormState((current) => ({
        ...current,
        error: error.message,
      }))
    } finally {
      setFormState((current) => ({
        ...current,
        submitting: false,
      }))
    }
  }

  async function handleDeleteHolding(holdingId) {
    logCustomerAction('delete_holding_clicked', { holdingId, mode: portfolioState.mode })
    if (portfolioState.mode === 'demo') {
      setActionState((current) => ({
        ...current,
        deletingId: null,
        error: '',
      }))
      showToast('Remove holding is disabled in presentation mode.', 'info')
      return
    }

    const shouldDelete = window.confirm('Are you sure you want to remove this holding?')
    if (!shouldDelete) {
      logCustomerAction('delete_holding_cancelled', { holdingId })
      return
    }

    logCustomerAction('delete_holding_confirmed', { holdingId })

    setActionState((current) => ({
      ...current,
      deletingId: holdingId,
      error: '',
    }))

    try {
      await deleteHolding(holdingId)
      logCustomerAction('delete_holding_succeeded', { holdingId })
      await loadLiveSnapshot({ actionMessage: 'Holding deleted successfully.' })
      await loadHoldingsPage(holdingsPage, holdingsPageSize)
      const insights = await fetchInsights(performanceFrame)
      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: insights.risk,
      }))
    } catch (error) {
      logCustomerAction('delete_holding_failed', { holdingId, reason: error.message })
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
    } finally {
      setActionState((current) => ({
        ...current,
        deletingId: null,
      }))
    }
  }

  async function handleUpdateHolding(holdingId, quantity) {
    logCustomerAction('update_holding_clicked', { holdingId, quantity, mode: portfolioState.mode })
    if (portfolioState.mode === 'demo') {
      showToast('Update holding is disabled in presentation mode.', 'info')
      return false
    }

    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
      setActionState((current) => ({
        ...current,
        error: 'Quantity must be a whole number greater than 0.',
      }))
      return false
    }

    setActionState((current) => ({
      ...current,
      updatingId: holdingId,
      error: '',
    }))

    try {
      const updatedHolding = await updateHoldingQuantity(holdingId, { quantity: Math.trunc(quantity) })
      if (updatedHolding?.holdingId) {
        mergeHoldingIntoSnapshot(updatedHolding)
        mergeHoldingIntoVisiblePage(updatedHolding)
      }

      const [snapshotResult, insights] = await Promise.all([
        loadLiveSnapshot({ actionMessage: 'Holding updated successfully.' }),
        fetchInsights(performanceFrame),
      ])

      if (snapshotResult.ok) {
        await loadHoldingsPage(holdingsPage, holdingsPageSize)
      }

      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: insights.risk,
      }))
      setLiveAnnouncement('Holding quantity, market value, and portfolio metrics updated successfully.')
      return true
    } catch (error) {
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
      return false
    } finally {
      setActionState((current) => ({
        ...current,
        updatingId: null,
      }))
    }
  }

  function handleImportCsvClick() {
    if (portfolioState.mode === 'demo') {
      showToast('Import is disabled in presentation mode.', 'info')
      return
    }

    csvInputRef.current?.click()
  }

  async function handleImportCsvFileChange(event) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setActionState((current) => ({ ...current, importing: true, error: '' }))

    try {
      const parsedRows = parseHoldingsCsv(await file.text())
      const instrumentByTicker = new Map(
        (snapshot?.instruments ?? []).map((instrument) => [instrument.ticker?.toUpperCase(), instrument.instrumentId])
      )

      const payloads = []
      for (const row of parsedRows) {
        const quantity = Number(row.quantityRaw)
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity at CSV line ${row.lineNumber}.`)
        }

        let instrumentIdFromCsv = null
        let instrumentIdFromTicker = null

        if (row.instrumentIdRaw) {
          const parsedId = Number(row.instrumentIdRaw)
          if (Number.isFinite(parsedId) && parsedId > 0) {
            instrumentIdFromCsv = parsedId
          } else {
            // non-numeric value in instrument column (e.g. "AAPL") → treat as ticker
            instrumentIdFromTicker = instrumentByTicker.get(row.instrumentIdRaw.toUpperCase()) ?? null
          }
        }

        if (row.tickerRaw) {
          instrumentIdFromTicker = instrumentByTicker.get(row.tickerRaw.toUpperCase()) ?? instrumentIdFromTicker
        }

        if (instrumentIdFromCsv && instrumentIdFromTicker && instrumentIdFromCsv !== instrumentIdFromTicker) {
          throw new Error(
            `CSV line ${row.lineNumber} has conflicting instrumentId (${instrumentIdFromCsv}) and ticker (${row.tickerRaw || row.instrumentIdRaw}).`
          )
        }

        // Prefer ticker-based mapping because IDs can vary across databases.
        const instrumentId = instrumentIdFromTicker ?? instrumentIdFromCsv

        if (!instrumentId) {
          throw new Error(`Unknown instrument at CSV line ${row.lineNumber}. Use a valid instrumentId or ticker.`)
        }

        payloads.push({
          instrumentId,
          quantity,
        })
      }

      const results = await Promise.allSettled(payloads.map((payload) => addHolding(portfolioId, payload)))
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (successCount === 0) {
        const firstFailure = results.find((result) => result.status === 'rejected')
        throw new Error(firstFailure?.reason?.message ?? 'CSV import failed for all rows.')
      }

      await loadLiveSnapshot({ actionMessage: `Imported ${successCount} holding row(s) from CSV.` })
      setHoldingsPage(1)
      await loadHoldingsPage(1, holdingsPageSize)
      const insights = await fetchInsights(performanceFrame)
      setInsightState((current) => ({
        ...current,
        loading: false,
        error: insights.error,
        performanceByFrame: {
          ...current.performanceByFrame,
          [performanceFrame]: insights.performance,
        },
        risk: insights.risk,
      }))

      if (failedCount > 0) {
        showToast(`${failedCount} row(s) could not be imported. Check instrument IDs/tickers.`, 'info')
      }

      setLiveAnnouncement(
        `Imported ${successCount} row(s). Holdings list and totals have been refreshed and synchronized.`
      )
    } catch (error) {
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
    } finally {
      event.target.value = ''
      setActionState((current) => ({
        ...current,
        importing: false,
      }))
    }
  }

  async function handleExportStatementPdf() {
    if (holdingsView.length === 0) {
      showToast('No holdings available to export.', 'info')
      return
    }

    setActionState((current) => ({ ...current, exporting: true, error: '' }))

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      doc.setFontSize(16)
      doc.text('Portfolio Holdings Statement', 40, 48)
      doc.setFontSize(10)
      doc.text(`As of ${formatDateLabel(dashboard?.asOf)}`, 40, 66)
      doc.text(`Portfolio ID: ${portfolioId}`, 40, 82)

      autoTable(doc, {
        startY: 98,
        head: [['Ticker', 'Instrument', 'Asset class', 'Qty', 'Avg cost', 'Price', 'Market value', 'Gain/Loss']],
        body: holdingsView.map((holding) => [
          holding.ticker,
          holding.name,
          holding.assetClass,
          formatQuantity(holding.quantity),
          formatDualCurrency(holding.avgCost, holding.currency),
          formatDualCurrency(holding.currentPrice, holding.currency),
          formatDualCurrency(holding.currentValue, holding.currency),
          `${formatDualSignedCurrency(holding.gainLossAmount, holding.currency)} (${formatSignedPercent(holding.gainLossPercentage, 1)})`,
        ]),
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [13, 23, 38] },
      })

      const totalValue = holdingsView.reduce(
        (sum, holding) => sum + convertAmountForDisplay(holding.currentValue, holding.currency, displayCurrency),
        0
      )
      const totalGainLoss = holdingsView.reduce(
        (sum, holding) => sum + convertAmountForDisplay(holding.gainLossAmount, holding.currency, displayCurrency),
        0
      )
      const finalY = doc.lastAutoTable?.finalY ?? 98

      doc.setFontSize(11)
      doc.text(`Display currency: ${displayCurrency}`, 40, finalY + 24)
      doc.text(`Total market value: ${formatCurrency(totalValue, displayCurrency, 1)}`, 40, finalY + 40)
      doc.text(`Total gain/loss: ${formatSignedCurrency(totalGainLoss, displayCurrency, 1)}`, 40, finalY + 56)

      const datePart = new Date().toISOString().slice(0, 10)
      doc.save(`portfolio-statement-${datePart}.pdf`)
      showToast('PDF statement exported.', 'success')
    } catch (error) {
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
    } finally {
      setActionState((current) => ({
        ...current,
        exporting: false,
      }))
    }
  }

  async function handleExportPortfolioSummaryPdf() {
    setActionState((current) => ({ ...current, exportingSummary: true, error: '' }))

    try {
      const range = mapFrameToPerformanceRange(performanceFrame)
      const exportPayload = await getPortfolioSummaryExport(portfolioId, range, 365, 0.25)
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })

      const dashboardData = exportPayload?.dashboard
      const performanceSummary = exportPayload?.performanceSummary
      const performanceHoldings = Array.isArray(exportPayload?.performanceHoldings) ? exportPayload.performanceHoldings : []
      const allocationSlices = Array.isArray(dashboardData?.sectorAllocation) ? dashboardData.sectorAllocation : []
      const riskData = exportPayload?.risk

      doc.setFontSize(16)
      doc.text('Portfolio Summary Report', 40, 48)
      doc.setFontSize(10)
      doc.text(`As of ${formatDateLabel(dashboardData?.asOf)}`, 40, 66)
      doc.text(`Portfolio ID: ${portfolioId}`, 40, 82)
      doc.text(`Performance range: ${exportPayload?.range ?? range}`, 40, 98)

      autoTable(doc, {
        startY: 114,
        head: [['Dashboard metric', 'Value']],
        body: [
          [
            'Current total asset value',
            formatDualCurrency(dashboardData?.totalAssetsCurrentValue ?? dashboardData?.totalPortfolioValue, dashboardData?.baseCurrency),
          ],
          [
            'Total invested value',
            formatDualCurrency(dashboardData?.totalAssetsInvestedValue ?? dashboardData?.totalInvestedAmount, dashboardData?.baseCurrency),
          ],
          [
            'Total return',
            `${formatDualSignedCurrency(dashboardData?.totalReturnAmount, dashboardData?.baseCurrency)} (${formatPercent(dashboardData?.totalReturnPercentage, 1)})`,
          ],
          [
            'Day return',
            `${formatDualSignedCurrency(dashboardData?.dayReturnAmount, dashboardData?.baseCurrency)} (${formatPercent(dashboardData?.dayReturnPercentage, 1)})`,
          ],
          ['Holdings count', String(dashboardData?.holdingsCount ?? 0)],
        ],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [13, 23, 38] },
      })

      if (allocationSlices.length > 0) {
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
          head: [['Asset allocation', 'Current value', 'Weight']],
          body: allocationSlices.map((slice) => [
            slice.label,
            formatDualCurrency(slice.value, dashboardData?.baseCurrency),
            formatPercent(slice.percentage, 2),
          ]),
          styles: { fontSize: 9, cellPadding: 6 },
          headStyles: { fillColor: [13, 23, 38] },
        })
      }

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
        head: [['Performance summary', 'Value']],
        body: [
          [
            'Best performer',
            `${performanceSummary?.bestPerformer?.ticker ?? 'N/A'} (${formatPercent(
              performanceSummary?.bestPerformer?.returnPercentage,
              2
            )})`,
          ],
          [
            'Worst performer',
            `${performanceSummary?.worstPerformer?.ticker ?? 'N/A'} (${formatPercent(
              performanceSummary?.worstPerformer?.returnPercentage,
              2
            )})`,
          ],
        ],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [13, 23, 38] },
      })

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
        head: [['Ticker', 'Range return', 'Total return', 'Current value']],
        body: performanceHoldings.slice(0, 12).map((holding) => [
          holding.ticker,
          formatSignedPercent(holding.rangeReturnPercentage, 2),
          formatSignedPercent(holding.totalReturnPercentage, 2),
          formatDualCurrency(holding.currentValue, dashboardData?.baseCurrency),
        ]),
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [13, 23, 38] },
      })

      const portfolioVolatility = toNumber(riskData?.volatility?.portfolioVolatility) * 100
      const maxDrawdown = toNumber(riskData?.maxDrawdown) * 100
      const concentrationAlerts = Array.isArray(riskData?.concentrationAlerts) ? riskData.concentrationAlerts : []

      autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
        head: [['Risk analysis', 'Value']],
        body: [
          ['Portfolio volatility (annualized)', formatPercent(portfolioVolatility, 2)],
          ['Max drawdown', formatPercent(maxDrawdown, 2)],
        ],
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [13, 23, 38] },
      })

      if (concentrationAlerts.length > 0) {
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
          head: [['Ticker', 'Current weight', 'Threshold']],
          body: concentrationAlerts.map((alert) => [
            alert.ticker,
            formatPercent(toNumber(alert.currentWeight) * 100, 2),
            formatPercent(toNumber(alert.threshold) * 100, 2),
          ]),
          styles: { fontSize: 9, cellPadding: 6 },
          headStyles: { fillColor: [13, 23, 38] },
        })
      } else {
        autoTable(doc, {
          startY: (doc.lastAutoTable?.finalY ?? 114) + 20,
          body: [['No concentration alerts for selected threshold.']],
          styles: { fontSize: 9, cellPadding: 6 },
          theme: 'plain',
        })
      }

      const datePart = new Date().toISOString().slice(0, 10)
      doc.save(`portfolio-summary-${datePart}.pdf`)
      showToast('Portfolio summary PDF exported.', 'success')
    } catch (error) {
      setActionState((current) => ({
        ...current,
        error: error.message,
      }))
      showToast(`Export summary failed: ${error.message}`, 'error')
    } finally {
      setActionState((current) => ({
        ...current,
        exportingSummary: false,
      }))
    }
  }

  function handleDashboardActionRun() {
    if (dashboardAction === 'import-holdings') {
      handleImportCsvClick()
      return
    }

    if (dashboardAction === 'export-statement') {
      handleExportStatementPdf()
      return
    }

    if (dashboardAction === 'export-summary') {
      handleExportPortfolioSummaryPdf()
    }
  }

  const snapshot = portfolioState.snapshot
  const dashboard = snapshot?.dashboard
  const holdingsView = buildHoldingsView(snapshot?.holdings ?? [], snapshot?.instruments ?? [])
  const holdingsTotals = holdingsView.reduce(
    (accumulator, holding) => {
      const currency = holding.currency ?? dashboard?.baseCurrency ?? 'USD'
      const invested = convertAmountForDisplay(holding.investedAmount, currency, displayCurrency)
      const current = convertAmountForDisplay(holding.currentValue, currency, displayCurrency)
      const gainLoss = convertAmountForDisplay(holding.gainLossAmount, currency, displayCurrency)

      return {
        invested: accumulator.invested + invested,
        current: accumulator.current + current,
        gainLoss: accumulator.gainLoss + gainLoss,
      }
    },
    { invested: 0, current: 0, gainLoss: 0 }
  )
  const holdingsReturnPercent =
    holdingsTotals.invested > 0 ? (holdingsTotals.gainLoss / holdingsTotals.invested) * 100 : 0
  const assetClassAllocation = buildAssetClassAllocation(holdingsView, dashboard)
  const tickerTape = buildTickerTape(snapshot?.instruments ?? [], holdingsView)
  const performanceSeries = buildPerformanceSeries(dashboard?.valueOverTime ?? [], performanceFrame)
  const frameInsights = insightState.performanceByFrame[performanceFrame]
  const summaryTop = frameInsights?.summary?.bestPerformer
  const summaryWorst = frameInsights?.summary?.worstPerformer
  const localPerformanceExtremes = findPerformanceExtremes(holdingsView)
  const performanceExtremes = {
    top: summaryTop
      ? {
          ticker: summaryTop.ticker,
          name: summaryTop.instrumentName,
          gainLossPercentage: toNumber(summaryTop.returnPercentage),
        }
      : localPerformanceExtremes.top,
    weak: summaryWorst
      ? {
          ticker: summaryWorst.ticker,
          name: summaryWorst.instrumentName,
          gainLossPercentage: toNumber(summaryWorst.returnPercentage),
        }
      : localPerformanceExtremes.weak,
  }
  const apiComparisonSeries = buildTopWorstSeriesFromApi(frameInsights?.comparison, performanceFrame)
  const performanceChartSeries =
    apiComparisonSeries.length > 0
      ? apiComparisonSeries
      : buildPerformerComparisonSeries(
          performanceSeries,
          performanceExtremes.top?.gainLossPercentage ?? dashboard?.totalReturnPercentage ?? 0,
          performanceExtremes.weak?.gainLossPercentage ?? dashboard?.totalReturnPercentage ?? 0
        )
  const riskOverview = buildRiskOverview(dashboard, holdingsView, assetClassAllocation, insightState.risk)
  const valueSeries = dashboard?.valueOverTime ?? []
  const latestValuePoint = valueSeries[valueSeries.length - 1]
  const healthScore = Math.max(0, Math.min(100, Math.round(riskOverview.score * 0.72 + 28)))
  const healthLabel = healthScore >= 75 ? 'Strong' : healthScore >= 55 ? 'Balanced' : 'Needs review'
  const dashboardGreeting = getTimeGreeting()
  const currentYear = new Date().getFullYear()
  const filteredHoldings = holdingsView.filter((holding) => {
    const searchValue = deferredSearch.trim().toLowerCase()
    if (!searchValue) {
      return true
    }

    return [holding.ticker, holding.name, holding.assetClass, holding.exchange]
      .join(' ')
      .toLowerCase()
      .includes(searchValue)
  })
  const isServerPaginatedHoldings = deferredSearch.trim() === ''
  const holdingsTotalPages = isServerPaginatedHoldings
    ? Math.max(1, holdingsPageState.totalPages)
    : Math.max(1, Math.ceil(filteredHoldings.length / holdingsPageSize))
  const activeHoldingsPage = Math.min(holdingsPage, holdingsTotalPages)
  const pagedHoldings = isServerPaginatedHoldings
    ? holdingsPageState.items
    : filteredHoldings.slice((activeHoldingsPage - 1) * holdingsPageSize, activeHoldingsPage * holdingsPageSize)
  const holdingsTotalItems = isServerPaginatedHoldings ? holdingsPageState.totalItems : filteredHoldings.length
  const isDashboardActionRunning = actionState.importing || actionState.exporting || actionState.exportingSummary

  useEffect(() => {
    setHoldingsPage((current) => Math.min(current, holdingsTotalPages))
  }, [holdingsTotalPages])

  useEffect(() => {
    if (!isServerPaginatedHoldings) {
      return
    }

    if (activeTab !== 'holdings') {
      return
    }

    loadHoldingsPage(holdingsPage, holdingsPageSize)
  }, [isServerPaginatedHoldings, holdingsPage, holdingsPageSize, activeTab])

  if (portfolioState.status === 'loading' && !snapshot) {
    return (
      <div className="loading-shell">
        <LoaderCircle className="spin" size={28} />
        <p>Loading portfolio presentation workspace...</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="market-strip">
        {tickerTape.map((item) => (
          <div key={item.ticker} className="ticker-chip">
            <span className="ticker-symbol">{item.ticker}</span>
            <span className="ticker-price">{formatDualCurrency(item.currentPrice, item.currency)}</span>
            <span className={item.change >= 0 ? 'ticker-change positive' : 'ticker-change negative'}>
              {item.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {formatPercent(item.change, 1)}
            </span>
          </div>
        ))}
      </div>

      <header className="hero-shell">
        <div className="hero-topline">
          <div>
            <p className="brand-mark">SheCodes</p>
          </div>

          <div className="hero-actions">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="visually-hidden-input"
              onChange={handleImportCsvFileChange}
            />
            <button
              type="button"
              className="accent-button"
              onClick={() => {
                logCustomerAction('add_holding_form_opened', { source: 'header_button' })
                setShowAddForm(true)
              }}
            >
              + Add holding
            </button>

            <div className="currency-select-shell">
              <select
                id="display-currency-select"
                className="dashboard-action-select currency-select"
                aria-label="Display currency"
                value={displayCurrency}
                onChange={(event) => {
                  const nextCurrency = event.target.value
                  setDisplayCurrency(nextCurrency)
                  refreshDisplayFxRates(nextCurrency)
                  logCustomerAction('display_currency_changed', { currency: nextCurrency })
                }}
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </div>

            <div className="dashboard-action-row hero-dropdown-row">
              <select
                id="dashboard-action-select"
                className="dashboard-action-select"
                aria-label="Header action"
                value={dashboardAction}
                onChange={(event) => setDashboardAction(event.target.value)}
              >
                <option value="import-holdings">Import holdings</option>
                <option value="export-statement">Export statements</option>
                <option value="export-summary">Export portfolio summary</option>
              </select>

              <button
                type="button"
                className="ghost-button"
                onClick={handleDashboardActionRun}
                disabled={isDashboardActionRunning || (dashboardAction === 'import-holdings' && portfolioState.mode === 'demo')}
              >
                {isDashboardActionRunning ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
                {actionState.importing
                  ? 'Importing CSV...'
                  : actionState.exporting
                    ? 'Exporting statement...'
                    : actionState.exportingSummary
                      ? 'Exporting summary...'
                      : 'Run action'}
              </button>
            </div>
          </div>
        </div>

        <nav className="tab-bar" aria-label="Portfolio sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={tab.id === activeTab ? 'tab-pill active' : 'tab-pill'}
              onClick={() =>
                startTransition(() => {
                  logCustomerAction('tab_changed', { from: activeTab, to: tab.id })
                  setActiveTab(tab.id)
                })
              }
            >
              {tab.label}
            </button>
          ))}
          {isTabPending ? <span className="tab-status">Switching view...</span> : null}
        </nav>
      </header>

      {actionState.error ? <div className="error-banner">{actionState.error}</div> : null}
      {portfolioState.mode === 'demo' && portfolioState.message ? (
        <div className="error-banner">Backend unavailable: {portfolioState.message}</div>
      ) : null}
      {insightState.error ? <div className="error-banner">{insightState.error}</div> : null}
      {toastState.visible ? <div className={`toast-popup ${toastState.type}`}>{toastState.message}</div> : null}
      <div className="sr-live" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <main className="page-shell">
        {showAddForm ? (
          <section className="panel add-holding-panel">
            <div className="panel-header">
              <div>
                <h2>Add a new holding</h2>
              </div>
              <BriefcaseBusiness size={20} className="panel-icon" />
            </div>

            <form className="trade-form" onSubmit={handleAddHolding}>
              <label>
                Instrument
                <select
                  value={formState.instrumentId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, instrumentId: event.target.value }))
                  }
                >
                  {(snapshot?.instruments ?? []).map((instrument) => (
                    <option key={instrument.instrumentId} value={instrument.instrumentId}>
                      {instrument.ticker} - {instrument.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Quantity
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formState.quantity}
                  placeholder="e.g. 10"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, quantity: event.target.value }))
                  }
                />
              </label>

              <div className="form-actions">
                <button
                  type="button"
                  className="panel-ghost-button"
                  onClick={() => {
                    logCustomerAction('add_holding_form_closed', { source: 'cancel_button' })
                    setShowAddForm(false)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="accent-button" disabled={formState.submitting}>
                  {formState.submitting ? 'Saving...' : 'Add position'}
                </button>
              </div>
            </form>

            {formState.error ? <p className="form-error">{formState.error}</p> : null}
          </section>
        ) : null}

        {activeTab !== 'risk' ? (
          <div className="persistent-metrics-bar">
            <div className="metric-grid">
              <MetricCard
                label="Current total asset value"
                value={formatCurrency(holdingsTotals.current, displayCurrency, 1)}
                hint={`${formatDualSignedCurrency(dashboard?.dayReturnAmount, dashboard?.baseCurrency)} today`}
                positive={toNumber(dashboard?.dayReturnAmount) >= 0}
              />
              <MetricCard
                label="Total invested value"
                value={formatCurrency(holdingsTotals.invested, displayCurrency, 1)}
                hint="Value at time of investment"
              />
              <MetricCard
                label="Total P&L"
                value={formatPercent(holdingsReturnPercent, 1)}
                hint={`${formatSignedCurrency(holdingsTotals.gainLoss, displayCurrency, 1)} since inception`}
                positive={holdingsTotals.gainLoss >= 0}
              />
              <MetricCard
                label="Holdings"
                value={String(holdingsView.length)}
                hint={`${dashboard?.stockCount ?? 0} stocks, ${(dashboard?.etfCount ?? 0) + (dashboard?.bondCount ?? 0)} funds`}
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'dashboard' ? (
          <DashboardTab
            greeting={dashboardGreeting}
            dashboard={dashboard}
            holdings={holdingsView}
            allocation={assetClassAllocation}
            onRefresh={handleRefreshPrices}
            isRefreshing={actionState.refreshing || portfolioState.status === 'refreshing'}
            mode={portfolioState.mode}
            healthScore={healthScore}
            healthLabel={healthLabel}
            valueSeriesCount={valueSeries.length}
            latestSeriesDate={latestValuePoint?.date}
            usdToInr={usdToInr}
            formatDualCurrency={formatDualCurrency}
            formatCompactDisplayCurrency={formatCompactDisplayCurrency}
            displayCurrency={displayCurrency}
          />
        ) : null}

        {activeTab === 'holdings' ? (
          <HoldingsTab
            holdings={pagedHoldings}
            loading={holdingsPageState.loading}
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              logCustomerAction('holdings_search_updated', { query: value })
              setSearchQuery(value)
              setHoldingsPage(1)
              setLiveAnnouncement(`Holdings filter applied. Query: ${value || 'all holdings'}.`)
            }}
            onDelete={handleDeleteHolding}
            onUpdate={handleUpdateHolding}
            deletingId={actionState.deletingId}
            updatingId={actionState.updatingId}
            mode={portfolioState.mode}
            page={activeHoldingsPage}
            totalPages={holdingsTotalPages}
            pageSize={holdingsPageSize}
            totalItems={holdingsTotalItems}
            onPageChange={(nextPage) => {
              setHoldingsPage(nextPage)
              setLiveAnnouncement(`Moved to holdings page ${nextPage} of ${holdingsTotalPages}.`)
            }}
            onPageSizeChange={(size) => {
              setHoldingsPageSize(size)
              setHoldingsPage(1)
              setLiveAnnouncement(`Rows per page changed to ${size}.`)
            }}
            onOpenAddForm={() => {
              logCustomerAction('add_holding_form_opened', { source: 'holdings_empty_state' })
              setShowAddForm(true)
            }}
            usdToInr={usdToInr}
            formatDualCurrency={formatDualCurrency}
            formatDualSignedCurrency={formatDualSignedCurrency}
          />
        ) : null}

        {activeTab === 'performance' ? (
          <PerformanceTab
            frame={performanceFrame}
            setFrame={(nextFrame) => {
              logCustomerAction('performance_range_changed', { frame: nextFrame })
              setPerformanceFrame(nextFrame)
            }}
            dashboard={dashboard}
            series={performanceChartSeries}
            performanceExtremes={performanceExtremes}
            onUserAction={logCustomerAction}
            usdToInr={usdToInr}
            formatDualCurrency={formatDualCurrency}
            formatCompactDisplayCurrency={formatCompactDisplayCurrency}
          />
        ) : null}

        {activeTab === 'risk' ? (
          <RiskTab
            dashboard={dashboard}
            overview={riskOverview}
            formatDualCurrency={formatDualCurrency}
            currentPortfolioDisplayValue={formatCurrency(holdingsTotals.current, displayCurrency, 1)}
          />
        ) : null}
      </main>

      <footer className="app-footer" role="contentinfo">
        <p className="footer-brand">SheCodes Portfolio Manager</p>
        <p className="footer-meta">© {currentYear} SheCodes. All rights reserved.</p>
      </footer>
    </div>
  )
}

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function DashboardTab({
  greeting,
  dashboard,
  holdings,
  allocation,
  onRefresh,
  isRefreshing,
  mode,
  healthScore,
  healthLabel,
  valueSeriesCount,
  latestSeriesDate,
  usdToInr,
  formatDualCurrency,
  formatCompactDisplayCurrency,
  displayCurrency,
}) {
  return (
    <section className="page-stack">
      <div className="page-heading">
        <h1>{greeting}</h1>
        <p className="page-subtitle">
          As of {formatDateLabel(dashboard?.asOf)} | Display currency {displayCurrency} | 1 USD = {formatCurrency(1, 'INR', usdToInr)}
        </p>
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Portfolio value over time</h2>
              <p className="panel-copy">
                {valueSeriesCount > 0
                  ? `${valueSeriesCount} points loaded • Latest point ${formatDateLabel(latestSeriesDate)}`
                  : 'No historical points yet. Refresh prices to seed portfolio history.'}
              </p>
            </div>
            <button type="button" className="panel-ghost-button" onClick={onRefresh} disabled={isRefreshing || mode === 'demo'}>
              <RefreshCcw size={16} className={isRefreshing ? 'spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh prices'}
            </button>
          </div>

          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={buildPerformanceSeries(dashboard?.valueOverTime ?? [], 'month')}>
                <defs>
                  <linearGradient id="dashboardFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d1a329" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#d1a329" stopOpacity="0.03" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e8dfcf" strokeDasharray="2 8" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#5b6475', fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#5b6475', fontSize: 12 }}
                  tickFormatter={(value) => formatCompactDisplayCurrency(value, dashboard?.baseCurrency)}
                />
                <Tooltip
                  formatter={(value) => formatDualCurrency(value, dashboard?.baseCurrency)}
                  labelFormatter={(label) => `Date: ${label}`}
                  contentStyle={{ borderRadius: 18, border: '1px solid #d9d0bf' }}
                />
                <Area type="monotone" dataKey="value" stroke="#c69a24" strokeWidth={3} fill="url(#dashboardFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Allocation by asset class</h2>
            </div>
            <CandlestickChart size={20} className="panel-icon" />
          </div>

          <div className="allocation-layout">
            <div className="donut-frame">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    innerRadius={80}
                    outerRadius={112}
                    paddingAngle={3}
                    stroke="transparent"
                  >
                    {allocation.map((slice) => (
                      <Cell key={slice.label} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatDualCurrency(value, dashboard?.baseCurrency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="legend-list">
              {allocation.map((slice) => (
                <div key={slice.label} className="legend-row">
                  <span className="legend-label">
                    <span className="legend-dot" style={{ backgroundColor: slice.color }}></span>
                    {slice.label}
                  </span>
                  <span>{formatPercent(slice.percentage, 1)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      

      
    </section>
  )
}

function HoldingsTab({
  holdings,
  loading,
  searchQuery,
  onSearchChange,
  onDelete,
  onUpdate,
  deletingId,
  updatingId,
  mode,
  onOpenAddForm,
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  formatDualCurrency,
  formatDualSignedCurrency,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editingQuantity, setEditingQuantity] = useState('')
  const [editingError, setEditingError] = useState('')

  async function handleSaveUpdate(holdingId) {
    const raw = editingQuantity.trim()
    const quantity = Number(raw)

    if (!raw || !/^\d+$/.test(raw)) {
      setEditingError('Quantity must be a whole number (digits only, no decimals).')
      return
    }

    if (quantity < 1) {
      setEditingError('Quantity must be greater than 0.')
      return
    }

    setEditingError('')
    const succeeded = await onUpdate(holdingId, quantity)
    if (succeeded) {
      setEditingId(null)
      setEditingQuantity('')
      setEditingError('')
    }
  }

  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <h1>Holdings</h1>
      </div>

      <div className="toolbar-row">
        <label className="search-shell">
          <Search size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by ticker, company, type or exchange"
          />
        </label>

        {mode === 'demo' ? <div className="toolbar-note">Demo mode: edits disabled</div> : null}
      </div>

      <div className="holdings-pagination-toolbar">
        <div className="toolbar-note">
          Showing {holdings.length === 0 ? 0 : (page - 1) * pageSize + 1}-
          {Math.min(page * pageSize, totalItems)} of {totalItems}
        </div>

        <label className="page-size-shell" htmlFor="holdings-page-size">
          Rows per page
          <select
            id="holdings-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
      </div>

      <section className="panel table-panel">
        <div className="table-headings">
          <span>Instrument</span>
          <span>Type</span>
          <span>Qty</span>
          <span>Avg. cost</span>
          <span>Investment total</span>
          <span>Current    price</span>
          <span>Current    value</span>
          <span>Gain/Loss</span>
          <span>Action</span>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading holdings...</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="empty-state">
            <p>No holdings were returned from Holding API for this view.</p>
            <p className="panel-copy">Try clearing the filters, or open the add holding form to stage a new position.</p>
            <button type="button" className="accent-button empty-state-action" onClick={onOpenAddForm}>
              Open add holding
            </button>
          </div>
        ) : (
          holdings.map((holding) => (
            <div key={holding.holdingId} className="table-row">
              <div>
                <strong>{holding.ticker}</strong>
                <span>{holding.name}</span>
              </div>
              <div>
                <span className="asset-pill">{holding.assetClass}</span>
              </div>
              <div>
                {editingId === holding.holdingId ? (
                  <input
                    className="inline-quantity-input"
                    type="number"
                    min="1"
                    step="1"
                    value={editingQuantity}
                    onChange={(event) => {
                      const raw = event.target.value
                      if (raw === '' || /^\d+$/.test(raw)) {
                        setEditingQuantity(raw)
                        setEditingError('')
                      } else {
                        setEditingError('Quantity must be a whole number (no decimals).')
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleSaveUpdate(holding.holdingId)
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setEditingId(null)
                        setEditingQuantity('')
                        setEditingError('')
                      }
                    }}
                    aria-invalid={Boolean(editingError)}
                  />
                ) : (
                  formatQuantity(holding.quantity)
                )}
              </div>
              <div>{formatDualCurrency(holding.avgCost, holding.currency)}</div>
              <div>{formatDualCurrency(holding.investedAmount, holding.currency)}</div>
              <div>{formatDualCurrency(holding.currentPrice, holding.currency)}</div>
              <div>{formatDualCurrency(holding.currentValue, holding.currency)}</div>
              <div className={holding.gainLossAmount >= 0 ? 'gain positive' : 'gain negative'}>
                {formatDualSignedCurrency(holding.gainLossAmount, holding.currency)} ({formatSignedPercent(holding.gainLossPercentage, 1)})
              </div>
              <div className="row-actions">
                {editingId === holding.holdingId ? (
                  <>
                    <button
                      type="button"
                      className="inline-action update"
                      onClick={() => handleSaveUpdate(holding.holdingId)}
                      disabled={updatingId === holding.holdingId || mode === 'demo'}
                    >
                      {updatingId === holding.holdingId ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
                      Save
                    </button>
                    <button
                      type="button"
                      className="inline-action cancel"
                      onClick={() => {
                        setEditingId(null)
                        setEditingQuantity('')
                        setEditingError('')
                      }}
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="inline-action edit"
                    onClick={() => {
                      setEditingId(holding.holdingId)
                      setEditingQuantity(String(holding.quantity))
                      setEditingError('')
                    }}
                    disabled={mode === 'demo'}
                  >
                    <Pencil size={14} />
                    Update
                  </button>
                )}
                <button
                  type="button"
                  className="inline-action"
                  onClick={() => onDelete(holding.holdingId)}
                  disabled={deletingId === holding.holdingId || mode === 'demo'}
                >
                  {deletingId === holding.holdingId ? <LoaderCircle className="spin" size={14} /> : <Trash2 size={14} />}
                  Remove
                </button>
              </div>
            </div>
          ))
        )}

        {editingError ? <p className="form-error inline-edit-error">{editingError}</p> : null}
      </section>

      <div className="holdings-page-controls" role="navigation" aria-label="Holdings pages">
        <button type="button" className="page-button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          {'<'}
        </button>
        <span className="page-indicator">
          {page} / {totalPages}
        </span>
        <button type="button" className="page-button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          {'>'}
        </button>
      </div>
    </section>
  )
}

function PerformanceTab({ frame, setFrame, dashboard, series, performanceExtremes, onUserAction, formatDualCurrency, formatCompactDisplayCurrency }) {
  const [focusSeries, setFocusSeries] = useState('both')

  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <p className="section-label">Performance</p>
        <h1 className="heading-compact-sm">Top vs Worst</h1>
      </div>

      <section className="panel chart-panel">
        <div className="panel-header">
          <div>
            <p className="section-label">Range</p>
            <h2>Comparative return graph</h2>
          </div>

          <label className="page-size-shell" htmlFor="performance-range-select">
            Timeframe
            <select
              id="performance-range-select"
              value={frame}
              onChange={(event) => setFrame(event.target.value)}
            >
              {performanceFrames.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="performance-line-controls" role="group" aria-label="Line focus mode">
          <button
            type="button"
            className={focusSeries === 'top' ? 'line-filter active' : 'line-filter'}
            onClick={() => {
              setFocusSeries('top')
              onUserAction('performance_focus_changed', { focus: 'top' })
            }}
          >
            Best performer
          </button>
          <button
            type="button"
            className={focusSeries === 'worst' ? 'line-filter active' : 'line-filter'}
            onClick={() => {
              setFocusSeries('worst')
              onUserAction('performance_focus_changed', { focus: 'worst' })
            }}
          >
            Weakest performer
          </button>
          <button
            type="button"
            className={focusSeries === 'both' ? 'line-filter active' : 'line-filter'}
            onClick={() => {
              setFocusSeries('both')
              onUserAction('performance_focus_changed', { focus: 'both' })
            }}
          >
            Comparison view
          </button>
        </div>

        <div className="chart-frame wide">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={series}>
              <CartesianGrid vertical={false} stroke="#ebe5d7" strokeDasharray="4 10" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6b7483', fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#6b7483', fontSize: 12 }}
                tickFormatter={(value) => formatCompactDisplayCurrency(value, dashboard?.baseCurrency)}
              />
              <Tooltip
                shared={false}
                content={
                  <PerformanceLineTooltip
                    currency={dashboard?.baseCurrency}
                    focusSeries={focusSeries}
                    topTicker={performanceExtremes.top?.ticker}
                    worstTicker={performanceExtremes.weak?.ticker}
                    formatDualCurrency={formatDualCurrency}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="topLine"
                name={`Top: ${performanceExtremes.top?.ticker ?? 'N/A'}`}
                stroke="#2f7d63"
                strokeWidth={focusSeries === 'worst' ? 2 : 3.1}
                dot={false}
                connectNulls
                opacity={focusSeries === 'worst' ? 0.2 : 1}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="worstLine"
                name={`Worst: ${performanceExtremes.weak?.ticker ?? 'N/A'}`}
                stroke="#ac5449"
                strokeWidth={focusSeries === 'top' ? 2 : 3.1}
                dot={false}
                connectNulls
                opacity={focusSeries === 'top' ? 0.2 : 1}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="performance-summary-grid">
          <section className="performance-summary-card">
            <p className="section-label">Top performer</p>
            <h2>{performanceExtremes.top?.ticker ?? 'N/A'}</h2>
            <p className="summary-value positive">{formatPercent(performanceExtremes.top?.gainLossPercentage, 1)}</p>
            <p className="panel-copy">{performanceExtremes.top?.name ?? 'No position data available'} | Since purchase</p>
          </section>

          <section className="performance-summary-card">
            <p className="section-label">Weakest performer</p>
            <h2>{performanceExtremes.weak?.ticker ?? 'N/A'}</h2>
            <p className="summary-value negative">{formatPercent(performanceExtremes.weak?.gainLossPercentage, 1)}</p>
            <p className="panel-copy">{performanceExtremes.weak?.name ?? 'No position data available'} | Since purchase</p>
          </section>
        </div>
      </section>
    </section>
  )
}

function PerformanceLineTooltip({ active, payload, label, currency, focusSeries, topTicker, worstTicker, formatDualCurrency }) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const bySeries = new Map(payload.map((item) => [item.dataKey, item]))
  const topPoint = bySeries.get('topLine')
  const worstPoint = bySeries.get('worstLine')

  const showTop = focusSeries !== 'worst' && topPoint
  const showWorst = focusSeries !== 'top' && worstPoint

  return (
    <div className="performance-tooltip">
      <p className="performance-tooltip-date">Date: {label}</p>
      {showTop ? (
        <p className="performance-tooltip-line top">
          Top {topTicker ?? 'N/A'}: {formatDualCurrency(topPoint.value, currency)}
        </p>
      ) : null}
      {showWorst ? (
        <p className="performance-tooltip-line worst">
          Worst {worstTicker ?? 'N/A'}: {formatDualCurrency(worstPoint.value, currency)}
        </p>
      ) : null}
    </div>
  )
}

function RiskTab({ dashboard, overview, formatDualCurrency, currentPortfolioDisplayValue }) {
  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <h1>Risk analysis</h1>
      </div>

      <div className="notice-strip">
        <ShieldAlert size={16} />
        Risk signals are generated from current holdings concentration, cash buffer and portfolio value history. Use them for discussion, not financial advice.
      </div>

      <div className="risk-grid">
        <section className="panel risk-hero-card">
          <div className="panel-header">
            <div>
              <h2>{overview.level} risk</h2>
            </div>
            <Sparkles size={18} className="panel-icon" />
          </div>

          <div className="risk-score">{overview.score}</div>
          <div className="risk-meter">
            <span style={{ width: `${overview.score}%` }}></span>
          </div>

          <div className="risk-metrics-grid">
            <div>
              <span className="metric-caption">Current portfolio value</span>
              <strong>{currentPortfolioDisplayValue}</strong>
            </div>
            <div>
              <span className="metric-caption">Annualised volatility</span>
              <strong>{formatPercent(overview.volatility, 1)}</strong>
            </div>
            <div>
              <span className="metric-caption">Max drawdown</span>
              <strong>{formatPercent(overview.drawdown, 1)}</strong>
            </div>
            <div>
              <span className="metric-caption">Largest allocation</span>
              <strong>{formatPercent(overview.concentration, 1)}</strong>
            </div>
          </div>
        </section>

        {overview.observations.map((item) => (
          <section key={item.title} className="panel insight-card">
            <h2>{item.title}</h2>
            <p className="panel-copy">{item.body}</p>
          </section>
        ))}
      </div>

    </section>
  )
}

function MetricCard({ label, value, hint, positive }) {
  return (
    <section className="metric-card">
      <p className="section-label">{label}</p>
      <h2>{value}</h2>
      <p className={positive === undefined ? 'metric-hint' : positive ? 'metric-hint positive' : 'metric-hint negative'}>
        {hint}
      </p>
    </section>
  )
}

export default App
