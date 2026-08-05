import { useDeferredValue, useEffect, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  BriefcaseBusiness,
  CandlestickChart,
  Download,
  LoaderCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
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
  getPerformanceHoldings,
  getPerformanceSummary,
  getPerformanceTopWorstHistory,
  getPortfolioSnapshot,
  getRiskConcentration,
  getRiskMaxDrawdown,
  getRiskVolatility,
  refreshPortfolioPrices,
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
  mapFrameToPerformanceRange,
  performanceFrames,
  tabs,
  toNumber,
} from './lib/portfolio'

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
    error: '',
  })
  const [toastState, setToastState] = useState({
    visible: false,
    message: '',
    type: 'success',
  })
  const toastTimeoutRef = useRef(null)
  const [formState, setFormState] = useState({
    instrumentId: '',
    quantity: '',
    submitting: false,
    error: '',
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

    const failures = [
      summaryResult,
      holdingsResult,
      comparisonResult,
      volatilityResult,
      drawdownResult,
      concentrationResult,
    ].filter((result) => result.status === 'rejected')
    const error = failures.length > 0 ? 'Some analytics endpoints were unavailable; showing partial analytics.' : ''

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

  useEffect(() => {
    let active = true

    async function initialize() {
      const result = await loadLiveSnapshot({ loadingStatus: 'loading' })
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

  const snapshot = portfolioState.snapshot
  const dashboard = snapshot?.dashboard
  const holdingsView = buildHoldingsView(snapshot?.holdings ?? [], snapshot?.instruments ?? [])
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
            <span className="ticker-price">{formatCurrency(item.currentPrice, item.currency)}</span>
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
            <p className="brand-mark">SheCodes.</p>
            <p className="brand-subcopy">Portfolio manager v0.1 prototype</p>
          </div>

          <div className="hero-actions">
            <button type="button" className="ghost-button">
              <Download size={16} />
              Export statement
            </button>
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

      <main className="page-shell">
        {showAddForm ? (
          <section className="panel add-holding-panel">
            <div className="panel-header">
              <div>
                <p className="section-label">Trade entry</p>
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
                  className="ghost-button"
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
          />
        ) : null}

        {activeTab === 'holdings' ? (
          <HoldingsTab
            holdings={filteredHoldings}
            searchQuery={searchQuery}
            onSearchChange={(value) => {
              logCustomerAction('holdings_search_updated', { query: value })
              setSearchQuery(value)
            }}
            onDelete={handleDeleteHolding}
            deletingId={actionState.deletingId}
            mode={portfolioState.mode}
            onOpenAddForm={() => {
              logCustomerAction('add_holding_form_opened', { source: 'holdings_empty_state' })
              setShowAddForm(true)
            }}
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
          />
        ) : null}

        {activeTab === 'risk' ? (
          <RiskTab dashboard={dashboard} overview={riskOverview} />
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

function DashboardTab({ greeting, dashboard, holdings, allocation, onRefresh, isRefreshing, mode, healthScore, healthLabel }) {
  return (
    <section className="page-stack">
      <div className="page-heading">
        <p className="section-label">Overview</p>
        <h1>{greeting}</h1>
        <p className="page-subtitle">
          As of {formatDateLabel(dashboard?.asOf)} | Base currency USD
        </p>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Total portfolio value"
          value={formatCurrency(dashboard?.totalPortfolioValue, dashboard?.baseCurrency)}
          hint={`${formatCompactCurrency(dashboard?.dayReturnAmount, dashboard?.baseCurrency)} today`}
          positive={toNumber(dashboard?.dayReturnAmount) >= 0}
        />
        <MetricCard
          label="Total return"
          value={formatPercent(dashboard?.totalReturnPercentage, 1)}
          hint={`${formatCompactCurrency(dashboard?.totalReturnAmount, dashboard?.baseCurrency)} since inception`}
          positive={toNumber(dashboard?.totalReturnAmount) >= 0}
        />
        <MetricCard
          label="Holdings"
          value={String(dashboard?.holdingsCount ?? 0)}
          hint={`${dashboard?.stockCount ?? 0} stocks, ${(dashboard?.etfCount ?? 0) + (dashboard?.bondCount ?? 0)} funds`}
        />
        <MetricCard
          label="Cash available"
          value={formatCurrency(dashboard?.cashAvailable, dashboard?.baseCurrency)}
          hint={`${formatPercent(dashboard?.cashAvailablePercentage, 1)} of portfolio`}
        />
      </div>

      <div className="chart-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <p className="section-label">Trend</p>
              <h2>Portfolio value over time</h2>
              <p className="panel-copy"></p>
            </div>
            <button type="button" className="ghost-button" onClick={onRefresh} disabled={isRefreshing || mode === 'demo'}>
              <RefreshCcw size={16} className={isRefreshing ? 'spin' : ''} />
              {isRefreshing ? 'Refreshing' : 'Refresh prices'}
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
                  tickFormatter={(value) => formatCompactCurrency(value, dashboard?.baseCurrency)}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(value, dashboard?.baseCurrency)}
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
              <p className="section-label">Mix</p>
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
                  <Tooltip formatter={(value) => formatCurrency(value, dashboard?.baseCurrency)} />
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

      

      <section className="panel health-panel">
        <div>
          <p className="section-label">Portfolio health</p>
          <h2>{healthLabel}</h2>
        </div>
        <div className="health-score-block">
          <strong>{healthScore}/100</strong>
          <div className="health-meter">
            <span style={{ width: `${healthScore}%` }}></span>
          </div>
        </div>
      </section>
    </section>
  )
}

function HoldingsTab({ holdings, searchQuery, onSearchChange, onDelete, deletingId, mode, onOpenAddForm }) {
  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <p className="section-label">Browse</p>
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

      <section className="panel table-panel">
        <div className="table-headings">
          <span>Instrument</span>
          <span>Type</span>
          <span>Qty</span>
          <span>Avg. cost</span>
          <span>Price</span>
          <span>Market value</span>
          <span>Gain/Loss</span>
          <span>Action</span>
        </div>

        {holdings.length === 0 ? (
          <div className="empty-state">
            <p>No holdings match the current search.</p>
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
              <div>{formatQuantity(holding.quantity)}</div>
              <div>{formatCurrency(holding.avgCost, holding.currency)}</div>
              <div>{formatCurrency(holding.currentPrice, holding.currency)}</div>
              <div>{formatCurrency(holding.currentValue, holding.currency)}</div>
              <div className={holding.gainLossAmount >= 0 ? 'gain positive' : 'gain negative'}>
                {formatCompactCurrency(holding.gainLossAmount, holding.currency)} ({formatPercent(holding.gainLossPercentage, 1)})
              </div>
              <div>
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
      </section>
    </section>
  )
}

function PerformanceTab({ frame, setFrame, dashboard, series, performanceExtremes, onUserAction }) {
  const [focusSeries, setFocusSeries] = useState('both')

  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <p className="section-label">Analyze</p>
        <h1>Performance</h1>
      </div>

      <section className="panel chart-panel performance-panel">
        <div className="performance-controls">
          <label className="range-select-shell" htmlFor="performance-range-select">
            <span className="section-label">Time range</span>
            <select
              id="performance-range-select"
              className="range-select"
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
                tickFormatter={(value) => formatCompactCurrency(value, dashboard?.baseCurrency)}
              />
              <Tooltip
                shared={false}
                content={
                  <PerformanceLineTooltip
                    currency={dashboard?.baseCurrency}
                    focusSeries={focusSeries}
                    topTicker={performanceExtremes.top?.ticker}
                    worstTicker={performanceExtremes.weak?.ticker}
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

function PerformanceLineTooltip({ active, payload, label, currency, focusSeries, topTicker, worstTicker }) {
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
          Top {topTicker ?? 'N/A'}: {formatCurrency(topPoint.value, currency)}
        </p>
      ) : null}
      {showWorst ? (
        <p className="performance-tooltip-line worst">
          Worst {worstTicker ?? 'N/A'}: {formatCurrency(worstPoint.value, currency)}
        </p>
      ) : null}
    </div>
  )
}

function RiskTab({ dashboard, overview }) {
  return (
    <section className="page-stack">
      <div className="page-heading compact">
        <p className="section-label">Explore</p>
        <h1>Risk analysis</h1>
        <p className="page-subtitle">Portfolio posture, observations and discussion prompts for the client presentation.</p>
      </div>

      <div className="notice-strip">
        <ShieldAlert size={16} />
        Risk signals are generated from current holdings concentration, cash buffer and portfolio value history. Use them for discussion, not financial advice.
      </div>

      <div className="risk-grid">
        <section className="panel risk-hero-card">
          <div className="panel-header">
            <div>
              <p className="section-label">Overall posture</p>
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
            <div>
              <span className="metric-caption">Cash buffer</span>
              <strong>{formatPercent(dashboard?.cashAvailablePercentage, 1)}</strong>
            </div>
          </div>
        </section>

        {overview.observations.map((item) => (
          <section key={item.title} className="panel insight-card">
            <div className="insight-heading">
              {item.icon === 'brain' ? <BrainCircuit size={18} /> : <AlertTriangle size={18} />}
              <p className="section-label">{item.confidence}</p>
            </div>
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
