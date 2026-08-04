import { Component } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { SurveyFiltersContext } from '../../../context/SurveyFiltersContext'
import { parseSurveyDate } from '../../../config/mapConfig'
import '../../../css/panel.css'
import '../../../css/Filters.css'
import '../../../css/Dashboard.css'
import '../../../css/DataVisualization.css'
import '../../../css/PageLoader.css'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Cycled across every chart's slices/rows so a category's pie slice and its table row always match color.
const PALETTE = [
  '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6',
  '#14b8a6', '#22c55e', '#f59e0b', '#92400e', '#64748b',
]

// Distribution pies to show, in the order requested - each keyed off an existing location field.
const DISTRIBUTION_FIELDS = [
  { field: 'sideLR', title: 'Side of the Road', subtitle: 'Where the observation was made relative to the road (L/R/On Road)' },
  { field: 'isRoadkill', title: 'Roadkill?', subtitle: 'Roadkill vs. non-roadkill observations' },
  { field: 'targetSpecies', title: 'Target Species?', subtitle: 'Observations of target species vs. others' },
  { field: 'identified', title: 'Identified?', subtitle: 'Observations identified vs. unidentified' },
  { field: 'weatherConditions', title: 'Weather Conditions', subtitle: 'Conditions recorded during each survey' },
  { field: 'taxa', title: 'Taxonomy', subtitle: 'Breakdown of observations by taxonomic group' },
]

// Counts observations per calendar month (YYYY-MM, chronological order) from each location's surveyDate.
const buildMonthlyData = (locations) => {
  const counts = new Map()

  for (const location of locations) {
    const parsed = parseSurveyDate(location.surveyDate)
    if (!parsed) continue
    const key = `${parsed.year}-${parsed.month.padStart(2, '0')}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => {
      const [year, month] = key.split('-')
      return { period: `${MONTH_LABELS[Number(month) - 1]} ${year}`, count }
    })
}

// Counts observations per calendar year, same shape as buildMonthlyData so both feed the same chart/table JSX.
const buildYearlyData = (locations) => {
  const counts = new Map()

  for (const location of locations) {
    const parsed = parseSurveyDate(location.surveyDate)
    if (!parsed) continue
    counts.set(parsed.year, (counts.get(parsed.year) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ period: year, count }))
}

// Generic "count by field value" breakdown, blank/missing values fall back to "Unknown" (same convention
// used by SurveyFiltersContext's own filter-value grouping) - sorted with the largest slice first, and
// each entry gets a stable color from PALETTE so its pie slice and table row always match.
const buildFieldDistribution = (locations, field) => {
  const counts = new Map()

  for (const location of locations) {
    const label = location[field]?.trim() || 'Unknown'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const total = locations.length
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, count], index) => ({
      label,
      count,
      percentage: total === 0 ? 0 : (count / total) * 100,
      color: PALETTE[index % PALETTE.length],
    }))
}

// A field with only one distinct value (usually a single "Unknown" bucket) isn't a real breakdown to
// chart - this also hides fields that aren't actual sheet columns for the current survey type (e.g.
// "Roadkill?" isn't asked at all in the Rope Bridge/External sheets, so every row is blank), matching
// the same auto-hide convention Filters.jsx already uses for its field tabs.
const hasDistribution = (data) => data.length > 1

const MonthlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{label}</div>
      <div className="chart-tooltip-row">
        <span>Observations</span>
        <span className="chart-tooltip-value" style={{ color: 'var(--accent)' }}>{payload[0].value}</span>
      </div>
    </div>
  )
}

const DistributionTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const entry = payload[0].payload
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title" style={{ color: entry.color }}>{entry.label}</div>
      <div className="chart-tooltip-row">
        <span>Count</span>
        <span className="chart-tooltip-value" style={{ color: entry.color }}>{entry.count}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>Percentage</span>
        <span className="chart-tooltip-value" style={{ color: entry.color }}>{entry.percentage.toFixed(2)}%</span>
      </div>
    </div>
  )
}

// One donut chart + scrollable breakdown table, reused for every field in DISTRIBUTION_FIELDS.
class DistributionChart extends Component {
  render() {
    const { title, subtitle, data } = this.props
    const total = data.reduce((sum, entry) => sum + entry.count, 0)

    return (
      <div className="panel chart-card">
        <h3>{title}</h3>
        <p className="chart-card-subtitle">{subtitle}</p>
        {data.length === 0 ? (
          <p>No observations to chart.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={85}>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<DistributionTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-table">
              <div className="chart-table-row chart-table-total">
                <span>Total</span>
                <span>{total}</span>
              </div>
              <div className="chart-table-scroll">
                {data.map((entry) => (
                  <div className="chart-table-row" key={entry.label} style={{ color: entry.color }}>
                    <span>{entry.label}</span>
                    <span>{entry.count} ({entry.percentage.toFixed(2)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }
}

// Independent charts view - reuses the shared SurveyTypeTabs/filteredLocations from SurveyFiltersContext
// so the charts always reflect whatever survey type/filters are active elsewhere in the app.
class DataVisualizationSubpage extends Component {
  static contextType = SurveyFiltersContext

  state = { timeGranularity: 'monthly' }

  setTimeGranularity = (timeGranularity) => this.setState({ timeGranularity })

  render() {
    const { filteredLocations, isLocationsLoading } = this.context
    const { timeGranularity } = this.state

    if (isLocationsLoading) {
      return <div className="subpage-loader">Loading chart data...</div>
    }

    const timeSeriesData = timeGranularity === 'yearly'
      ? buildYearlyData(filteredLocations)
      : buildMonthlyData(filteredLocations)
    const timeSeriesTotal = timeSeriesData.reduce((sum, entry) => sum + entry.count, 0)

    return (
      <div className="dashboard-content">
        <div className="panel chart-card chart-card-wide">
          <div className="chart-card-toolbar">
            <h3>Observations Over Time</h3>
            <div className="filters-tab-row">
              <button
                type="button"
                className={`filters-tab${timeGranularity === 'monthly' ? ' filters-tab-active' : ''}`}
                onClick={() => this.setTimeGranularity('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`filters-tab${timeGranularity === 'yearly' ? ' filters-tab-active' : ''}`}
                onClick={() => this.setTimeGranularity('yearly')}
              >
                Yearly
              </button>
            </div>
          </div>
          <p className="chart-card-subtitle">
            {timeGranularity === 'yearly' ? 'Yearly' : 'Monthly'} trends in observation counts over time
          </p>
          {timeSeriesData.length === 0 ? (
            <p>No observations to chart.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip content={<MonthlyTooltip />} />
                  <Line type="monotone" dataKey="count" name="Observations" stroke="var(--accent)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
              <div className="chart-table">
                <div className="chart-table-row chart-table-total">
                  <span>Total</span>
                  <span>{timeSeriesTotal}</span>
                </div>
                <div className="chart-table-scroll">
                  {timeSeriesData.map((entry, index) => (
                    <div className="chart-table-row" key={entry.period} style={{ color: PALETTE[index % PALETTE.length] }}>
                      <span>{entry.period}</span>
                      <span>{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="charts-row">
          {DISTRIBUTION_FIELDS.map(({ field, title, subtitle }) => {
            const data = buildFieldDistribution(filteredLocations, field)
            if (!hasDistribution(data)) return null
            return <DistributionChart key={field} title={title} subtitle={subtitle} data={data} />
          })}
        </div>
      </div>
    )
  }
}

export default DataVisualizationSubpage
