import { Component } from 'react'
import CountUp from '../../../components/CountUp/CountUp'
import { buildSurveySummaryItems } from '../../../config/mapConfig'
import { SurveyFiltersContext } from '../../../context/SurveyFiltersContext'
import '../../../css/panel.css'
import '../../../css/Dashboard.css'
import '../../../css/Overview.css'
import '../../../css/PageLoader.css'

// Best-effort fun icon for a stat card based on its label text - purely decorative, falls back to a
// generic chart icon so every card still gets one even if the label doesn't match a known keyword.
const STAT_ICON_RULES = [
  [/volunteer/i, '🙋'],
  [/species/i, '🦋'],
  [/individual/i, '🐾'],
  [/survey/i, '📋'],
  [/side of the road|direction/i, '🧭'],
]
const iconForStat = (label) => STAT_ICON_RULES.find(([pattern]) => pattern.test(label))?.[1] ?? '📊'

// Computed from the shared filter bar's filteredLocations (rather than a separate unfiltered backend
// fetch) so this page's stats always match whatever survey type/filters/search are active everywhere
// else in the app.
class OverviewSubpage extends Component {
  static contextType = SurveyFiltersContext

  render() {
    const { filteredLocations, isLocationsLoading } = this.context

    if (isLocationsLoading) {
      return <div className="subpage-loader">Loading overview...</div>
    }

    const summary = buildSurveySummaryItems(filteredLocations)

    return (
      <div className="dashboard-content">
        <div className="overview-stats-grid">
          {summary.items.map(({ label, value }) => (
            <div className="panel overview-stat-card" key={label}>
              <span className="overview-stat-icon">{iconForStat(label)}</span>
              <p className="overview-stat-label">{label}</p>
              <p className="overview-stat-value">
                <CountUp value={value} />
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export default OverviewSubpage

