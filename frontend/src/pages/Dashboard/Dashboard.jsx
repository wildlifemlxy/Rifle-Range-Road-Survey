import { Component, createRef } from 'react'
import Header from '../../components/Header/Header'
import SurveyTypeTabs from '../../components/SurveyTypeTabs/SurveyTypeTabs'
import Filters from '../../components/Filters/Filters'
import ObservationsSubpage from './subpages/ObservationsSubpage'
import DataTableSubpage from './subpages/DataTableSubpage'
import OverviewSubpage from './subpages/OverviewSubpage'
import DataVisualizationSubpage from './subpages/DataVisualizationSubpage'
import { SurveyFiltersContext } from '../../context/SurveyFiltersContext'
import '../../css/Header.css'
import '../../css/Dashboard.css'
import '../../css/PageLoader.css'

export const DASHBOARD_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'data-visualization', label: 'Data Visualizations' },
  { key: 'observations', label: 'Observations' },
  { key: 'data-table', label: 'Data Table' },
]

// One-line usage instructions shown under each tab's title, centralized here (instead of duplicated
// inside each subpage) so every tab's page-header treatment is guaranteed identical.
const TAB_HINTS = {
  overview: 'Pick a survey type from the left menu and use the filters above to narrow this snapshot.',
  'data-visualization': 'Pick a survey type from the left menu and apply filters above to update the charts.',
  observations: 'Click Maps in the left menu to choose Regular or External, or pick Road Bridge, then use the filters above to narrow the map.',
  'data-table': 'Pick a survey type from the left menu, filter rows above, then use Export to download the table.',
}

const TAB_ICONS = {
  overview: '📊',
  'data-visualization': '📈',
  observations: '🗺️',
  'data-table': '🗂️',
}

const SUBPAGES = {
  overview: OverviewSubpage,
  'data-visualization': DataVisualizationSubpage,
  observations: ObservationsSubpage,
  'data-table': DataTableSubpage,
}

// Single "/dashboard" page - Overview/Data Visualizations/Observations/Data Table are tab-switched
// sub-pages here (no separate routes), so shared filter/context state naturally persists when
// switching tabs.
class Dashboard extends Component {
  static contextType = SurveyFiltersContext

  state = { activeTab: 'overview', pendingTab: null, scrollThumbHeightPct: 100, scrollThumbTopPct: 0 }

  scrollAreaRef = createRef()
  scrollTrackRef = createRef()
  isDragging = false

  componentDidMount() {
    this.recalcScrollbar()
    // Native scrollbars only paint while their content actually overflows (and even then, macOS/
    // trackpad-style browsers fade them out except while actively scrolling) - this app instead
    // always renders its own thumb, so it needs to be kept in sync with size changes that aren't
    // triggered by a React re-render (e.g. the Filters panel expanding/collapsing).
    this.resizeObserver = new ResizeObserver(this.recalcScrollbar)
    if (this.scrollAreaRef.current) this.resizeObserver.observe(this.scrollAreaRef.current)
    window.addEventListener('resize', this.recalcScrollbar)
  }

  componentDidUpdate() {
    this.recalcScrollbar()
  }

  componentWillUnmount() {
    this.resizeObserver?.disconnect()
    window.removeEventListener('resize', this.recalcScrollbar)
    window.removeEventListener('mousemove', this.handleThumbDragMove)
    window.removeEventListener('mouseup', this.handleThumbDragEnd)
  }

  setActiveTab = (tab) => this.setState({ activeTab: tab })

  // Switching dashboard tabs (Overview/Data Visualizations/Observations/Data Table) keeps the same
  // filters/search in place - but since each tab presents a very different view of that filtered data,
  // ask first whenever filters are actually restricting something, rather than silently carrying them over.
  handleTabClick = (tab) => {
    if (tab === this.state.activeTab) return
    if (this.context.hasActiveFilters()) {
      this.setState({ pendingTab: tab })
    } else {
      this.setActiveTab(tab)
    }
  }

  resolvePendingTabSwitch = (shouldReset) => {
    const { pendingTab } = this.state
    if (!pendingTab) return
    if (shouldReset) this.context.resetFilters()
    this.setState({ activeTab: pendingTab, pendingTab: null })
  }

  recalcScrollbar = () => {
    const el = this.scrollAreaRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const heightPct = Math.min(100, (clientHeight / scrollHeight) * 100)
    const maxScrollTop = scrollHeight - clientHeight
    const topPct = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * (100 - heightPct) : 0
    // Bail out if nothing actually changed - componentDidUpdate calls this on every render, and an
    // unconditional setState here would just re-trigger componentDidUpdate forever.
    const { scrollThumbHeightPct, scrollThumbTopPct } = this.state
    if (Math.abs(heightPct - scrollThumbHeightPct) < 0.1 && Math.abs(topPct - scrollThumbTopPct) < 0.1) return
    this.setState({ scrollThumbHeightPct: heightPct, scrollThumbTopPct: topPct })
  }

  // Dragging the thumb: track the pointer's Y delta since mousedown and translate it into a
  // proportional scrollTop change (proportional to how much track space the thumb can travel
  // through, not the raw pixel delta, so a short thumb on a long page still tracks the mouse 1:1).
  handleThumbMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const el = this.scrollAreaRef.current
    if (!el) return
    this.isDragging = true
    this.dragStartClientY = e.clientY
    this.dragStartScrollTop = el.scrollTop
    window.addEventListener('mousemove', this.handleThumbDragMove)
    window.addEventListener('mouseup', this.handleThumbDragEnd)
  }

  handleThumbDragMove = (e) => {
    if (!this.isDragging) return
    const el = this.scrollAreaRef.current
    const track = this.scrollTrackRef.current
    if (!el || !track) return
    const trackHeight = track.clientHeight
    const maxScrollTop = el.scrollHeight - el.clientHeight
    const thumbHeightPx = (this.state.scrollThumbHeightPct / 100) * trackHeight
    const draggableTrackPx = trackHeight - thumbHeightPx
    if (draggableTrackPx <= 0 || maxScrollTop <= 0) return
    const deltaY = e.clientY - this.dragStartClientY
    const scrollDelta = (deltaY / draggableTrackPx) * maxScrollTop
    el.scrollTop = Math.max(0, Math.min(maxScrollTop, this.dragStartScrollTop + scrollDelta))
  }

  handleThumbDragEnd = () => {
    this.isDragging = false
    window.removeEventListener('mousemove', this.handleThumbDragMove)
    window.removeEventListener('mouseup', this.handleThumbDragEnd)
  }

  // Clicking the bare track (not the thumb itself, which has its own drag handler above) jumps the
  // thumb - and therefore the scroll position - to center on the click point.
  handleTrackMouseDown = (e) => {
    const track = this.scrollTrackRef.current
    const el = this.scrollAreaRef.current
    if (!track || !el) return
    const rect = track.getBoundingClientRect()
    const trackHeight = rect.height
    const maxScrollTop = el.scrollHeight - el.clientHeight
    if (maxScrollTop <= 0) return
    const thumbHeightPx = (this.state.scrollThumbHeightPct / 100) * trackHeight
    const draggableTrackPx = trackHeight - thumbHeightPx
    const clickThumbTop = Math.max(0, Math.min(draggableTrackPx, e.clientY - rect.top - thumbHeightPx / 2))
    el.scrollTop = draggableTrackPx > 0 ? (clickThumbTop / draggableTrackPx) * maxScrollTop : 0
  }


  render() {
    // Holds off rendering the tabs/Header at all until the shared survey data has loaded once, rather
    // than revealing an empty/partial page that then pops in data a moment later.
    if (!this.context.isDataReady) {
      return <div className="page-loader">Loading survey data...</div>
    }

    const { activeTab, pendingTab } = this.state
    const {
      surveyType,
      requestSurveyTypeChange,
      fieldValues,
      activeValues,
      toggleValue,
      searchQuery,
      setSearchQuery,
      resetFilters,
    } = this.context
    const ActiveSubpage = SUBPAGES[activeTab]
    const activeTabLabel = DASHBOARD_TABS.find((tab) => tab.key === activeTab)?.label

    return (
      <>
        <Header onChangeTab={this.handleTabClick} />
        <div className="dashboard-body">
          {/* Filters card, then the main tab nav below/outside it - both sit outside the per-tab
              section since they're identical/shared across every tab. */}
          <div className="dashboard-fixed-top">
            <Filters
              fieldValues={fieldValues}
              activeValues={activeValues}
              onToggleValue={toggleValue}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onReset={resetFilters}
            />
            <nav className="app-header-tabs">
              {DASHBOARD_TABS.map(({ key, label }) => (
                <button
                  type="button"
                  key={key}
                  className={`header-tab${key === activeTab ? " header-tab-active" : ""}`}
                  onClick={() => this.handleTabClick(key)}
                >
                  <span className="header-tab-icon">{TAB_ICONS[key]}</span>
                  {label}
                </button>
              ))}
            </nav>
          </div>
          <section id={`${activeTab}-page`} className="dashboard-page">
            <div className="dashboard-page-columns">
              {/* Left-hand survey type menu, styled plain/borderless so it reads as a lightweight
                  sub-filter rather than another card. Only the Observations tab needs the Maps/Road
                  Bridge Den grouping (it picks a visualization); every other tab just needs the raw
                  Regular/Rope Bridge/External sheet choice. */}
              <div className="dashboard-page-menu">
                <SurveyTypeTabs
                  surveyType={surveyType}
                  onChange={requestSurveyTypeChange}
                  grouped={activeTab === "observations"}
                />
              </div>
              <div className="dashboard-scroll-wrapper">
                <div
                  className="dashboard-scroll-area"
                  ref={this.scrollAreaRef}
                  onScroll={this.recalcScrollbar}
                >
                  <div className="dashboard-page-header">
                    <h1>
                      <span className="dashboard-page-icon">{TAB_ICONS[activeTab]}</span>
                      <span className="dashboard-page-title-text">{activeTabLabel}</span>
                    </h1>
                    <p>{TAB_HINTS[activeTab]}</p>
                  </div>
                  <ActiveSubpage />
                </div>
                {/* Native scrollbars only paint once content actually overflows, and even then most
                    browsers/OSes (notably macOS) auto-hide them outside of an active scroll gesture -
                    this thumb is a plain always-rendered div kept in sync with real scroll state
                    instead, so the dark green scrollbar is visible regardless of platform or whether
                    there's currently anything to scroll. */}
                <div className="dashboard-scrollbar-track" ref={this.scrollTrackRef} onMouseDown={this.handleTrackMouseDown}>
                  <div
                    className="dashboard-scrollbar-thumb"
                    onMouseDown={this.handleThumbMouseDown}
                    style={{
                      height: `${this.state.scrollThumbHeightPct}%`,
                      top: `${this.state.scrollThumbTopPct}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
        {pendingTab && (
          <div className="tab-switch-overlay" role="dialog" aria-modal="true">
            <div className="tab-switch-dialog">
              <p>
                You have active filters. Switch to{' '}
                <strong>{DASHBOARD_TABS.find((tab) => tab.key === pendingTab)?.label}</strong> and reset
                them, or keep your current filters?
              </p>
              <div className="tab-switch-actions">
                <button type="button" onClick={() => this.resolvePendingTabSwitch(true)}>
                  Reset filters
                </button>
                <button type="button" onClick={() => this.resolvePendingTabSwitch(false)}>
                  Keep filters
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
}

export default Dashboard

