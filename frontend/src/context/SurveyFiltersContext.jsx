import { Component, createContext } from 'react'
import {
  FILTERABLE_FIELDS,
  fetchSurveyLocations,
  fetchSpeciesList,
  buildSpeciesStatusLookup,
  lookupSpeciesStatus,
} from '../config/mapConfig'
import { getSocket } from '../config/socket'

export const ALL_SIDES = ['North', 'South', 'Unknown']

// Class components consume this via `static contextType = SurveyFiltersContext` + `this.context`.
export const SurveyFiltersContext = createContext(null)

const getFieldValue = (location, field) => location[field]?.trim() || 'Unknown'

// Distinct values (in first-seen order) for every column that can be toggled as a filter, "side" included.
// Returns {} until locations have loaded so the default-seeding logic below doesn't lock in empty filter sets.
const buildFieldValues = (locations) => {
  if (locations.length === 0) return {}

  const fieldValues = { side: ALL_SIDES }

  for (const { field } of FILTERABLE_FIELDS) {
    const seen = new Set()
    for (const location of locations) {
      seen.add(location[field]?.trim() || 'Unknown')
    }
    fieldValues[field] = Array.from(seen).sort()
  }

  return fieldValues
}

// side (Directions legend) defaults fully-selected; every other filterable field defaults empty (no restriction).
const buildDefaultActiveValues = (fieldValues) => {
  const defaults = {}
  for (const field of Object.keys(fieldValues)) {
    defaults[field] = field === 'side' ? new Set(fieldValues[field]) : new Set()
  }
  return defaults
}

// Shared across the whole app (Map and Observations pages alike) so filter selections persist when
// navigating between sections instead of resetting per-page. Filters/search also carry over as-is
// when switching survey type (Regular <-> Rope Bridge <-> External) - no confirmation prompt.
// Class component: everything the old useSurveyFilters/useSocketStatus hooks used to manage is inlined
// directly here as instance state/methods, since class components can't call hooks.
export class SurveyFiltersProvider extends Component {
  state = {
    surveyType: 'Regular',
    locations: [],
    isLocationsLoading: true,
    activeValues: {},
    searchQuery: '',
    speciesStatusLookup: new Map(),
    isSpeciesLoading: true,
  }

  componentDidMount() {
    this._mounted = true
    this.fetchLocations(this.state.surveyType)
    this.fetchSpecies()

    const socket = getSocket()
    // Reads `this.state.surveyType` fresh on every event instead of a stale closed-over value, so this
    // one listener never needs to be re-subscribed when surveyType changes.
    this.handleSocketUpdate = (payload) => {
      if (payload.surveyType !== this.state.surveyType) return
      this.fetchLocations(this.state.surveyType)
    }
    socket.on('surveyDataUpdated', this.handleSocketUpdate)
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.surveyType !== this.state.surveyType) {
      this.fetchLocations(this.state.surveyType)
    }
    if (
      prevState.locations !== this.state.locations ||
      prevState.speciesStatusLookup !== this.state.speciesStatusLookup
    ) {
      this.syncDefaultActiveValues()
    }
  }

  componentWillUnmount() {
    this._mounted = false
    getSocket().off('surveyDataUpdated', this.handleSocketUpdate)
  }

  fetchLocations = (surveyType) => {
    this.setState({ isLocationsLoading: true })
    fetchSurveyLocations(surveyType)
      .then((data) => {
        if (this._mounted) this.setState({ locations: data, isLocationsLoading: false })
      })
      .catch((err) => {
        console.warn('Failed to fetch survey locations:', err)
        if (this._mounted) this.setState({ isLocationsLoading: false })
      })
  }

  fetchSpecies = () => {
    fetchSpeciesList()
      .then((data) => {
        if (this._mounted) this.setState({ speciesStatusLookup: buildSpeciesStatusLookup(data), isSpeciesLoading: false })
      })
      .catch((err) => {
        console.warn('Failed to fetch species list:', err)
        if (this._mounted) this.setState({ isSpeciesLoading: false })
      })
  }

  // Rope Bridge has no Taxa column at all, and External's Taxa/Target Species columns are broken
  // VLOOKUP formulas (evaluate to "#N/A", already blanked out by the backend) - both fall back to the
  // Species List tab's lookup (Table A by scientific name, Table B by common name). Regular's own Taxa/
  // Target Species columns are real, surveyor-filled data and must never be overridden, even when a
  // particular row leaves one blank - the actual survey table is always the source of truth for it.
  getEnrichedLocations = () => {
    const { locations, speciesStatusLookup } = this.state
    if (speciesStatusLookup.size === 0) return locations
    return locations.map((location) => {
      if (location.surveyType === 'Regular') return location
      if (location.taxa && location.targetSpecies) return location
      const status = lookupSpeciesStatus(speciesStatusLookup, location)
      if (!status) return location
      return {
        ...location,
        taxa: location.taxa || status.taxa || '',
        targetSpecies: location.targetSpecies || status.targetSpecies || '',
      }
    })
  }

  // Seeds a default for any field not already present in activeValues (side fully-selected, everything
  // else unrestricted) - same as the old effect keyed on the derived fieldValues changing.
  syncDefaultActiveValues = () => {
    const fieldValues = buildFieldValues(this.getEnrichedLocations())
    this.setState((prev) => {
      const next = { ...prev.activeValues }
      let changed = false
      for (const field of Object.keys(fieldValues)) {
        if (!(field in next)) {
          next[field] = field === 'side' ? new Set(fieldValues[field]) : new Set()
          changed = true
        }
      }
      return changed ? { activeValues: next } : null
    })
  }

  toggleValue = (field, value) => {
    this.setState((prev) => {
      const current = new Set(prev.activeValues[field] ?? [])
      if (current.has(value)) current.delete(value)
      else current.add(value)
      return { activeValues: { ...prev.activeValues, [field]: current } }
    })
  }

  // Clears every filter back to its default (side fully-selected, everything else unrestricted) and the search box.
  resetFilters = () => {
    const fieldValues = buildFieldValues(this.getEnrichedLocations())
    this.setState({ activeValues: buildDefaultActiveValues(fieldValues), searchQuery: '' })
  }

  setSearchQuery = (searchQuery) => {
    this.setState({ searchQuery })
  }

  hasActiveFilters = () => {
    if (this.state.searchQuery.trim() !== '') return true
    return Object.entries(this.state.activeValues).some(([field, values]) => {
      if (field === 'side') return values.size !== ALL_SIDES.length
      return values.size > 0
    })
  }

  // Filters/search always carry over as-is across a survey type switch (no reset prompt) - any field
  // whose selected values don't apply to the new dataset just won't match anything, same as if the user
  // had picked those values after switching.
  requestSurveyTypeChange = (next) => {
    if (next === this.state.surveyType) return
    this.setState({ surveyType: next })
  }

  getFilteredLocations = () => {
    const enrichedLocations = this.getEnrichedLocations()
    const { activeValues, searchQuery } = this.state
    const query = searchQuery.trim().toLowerCase()

    return enrichedLocations.filter((location) => {
      const sideSet = activeValues.side
      if (sideSet && !sideSet.has(location.side)) return false

      const matchesFilters = FILTERABLE_FIELDS.every(({ field }) => {
        const active = activeValues[field]
        if (!active || active.size === 0) return true
        return active.has(getFieldValue(location, field))
      })
      if (!matchesFilters) return false

      if (!query) return true
      return Object.values(location).some((value) => String(value ?? '').toLowerCase().includes(query))
    })
  }

  render() {
    const { children } = this.props
    const {
      surveyType,
      activeValues,
      searchQuery,
      speciesStatusLookup,
      isLocationsLoading,
      isSpeciesLoading,
    } = this.state
    const enrichedLocations = this.getEnrichedLocations()
    const fieldValues = buildFieldValues(enrichedLocations)

    const contextValue = {
      surveyType,
      requestSurveyTypeChange: this.requestSurveyTypeChange,
      locations: enrichedLocations,
      fieldValues,
      activeValues,
      toggleValue: this.toggleValue,
      filteredLocations: this.getFilteredLocations(),
      searchQuery,
      setSearchQuery: this.setSearchQuery,
      resetFilters: this.resetFilters,
      hasActiveFilters: this.hasActiveFilters,
      speciesStatusLookup,
      // Locations reflect whichever survey type is currently active; species status is a one-time,
      // survey-type-independent fetch. Individual tabs gate on `isLocationsLoading` (refetches whenever
      // the shared survey type changes), while the very first app load waits on both via `isDataReady`.
      isLocationsLoading,
      isDataReady: !isLocationsLoading && !isSpeciesLoading,
    }

    return (
      <SurveyFiltersContext.Provider value={contextValue}>
        {children}
      </SurveyFiltersContext.Provider>
    )
  }
}
