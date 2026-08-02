import { useEffect, useMemo, useState } from 'react'
import {
  FILTERABLE_FIELDS,
  fetchSurveyLocations,
  fetchSpeciesList,
  buildSpeciesStatusLookup,
} from '../config/mapConfig'
import { getSocket } from '../config/socket'

export const ALL_SIDES = ['North', 'South', 'Unknown']

// Distinct values (in first-seen order) for every column that can be toggled as a filter, "side" included.
// Returns {} until locations have loaded so the init effect below doesn't lock in empty filter sets.
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

const getFieldValue = (location, field) => {
  return location[field]?.trim() || 'Unknown'
}

// side (Directions legend) defaults fully-selected; every other filterable field defaults empty (no restriction).
const buildDefaultActiveValues = (fieldValues) => {
  const defaults = {}
  for (const field of Object.keys(fieldValues)) {
    defaults[field] = field === 'side' ? new Set(fieldValues[field]) : new Set()
  }
  return defaults
}

// Shared survey data + filter state, used by both the map page and the observations table page
// so filtering behaves identically without duplicating the fetch/toggle/derive logic.
export function useSurveyFilters(surveyType = 'Regular') {
  const [locations, setLocations] = useState([])
  const [activeValues, setActiveValues] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [speciesStatusLookup, setSpeciesStatusLookup] = useState(new Map())

  useEffect(() => {
    let cancelled = false

    fetchSurveyLocations(surveyType)
      .then((data) => {
        if (!cancelled) setLocations(data)
      })
      .catch((err) => console.warn('Failed to fetch survey locations:', err))

    return () => {
      cancelled = true
    }
  }, [surveyType])

  // Live updates: the backend polls the Google Sheet and emits when it detects a change, so
  // refetch this survey type's data whenever that happens instead of waiting for a manual reload.
  useEffect(() => {
    const socket = getSocket()

    const handleUpdate = (payload) => {
      if (payload.surveyType !== surveyType) return
      fetchSurveyLocations(surveyType)
        .then((data) => setLocations(data))
        .catch((err) => console.warn('Failed to refetch survey locations after live update:', err))
    }

    socket.on('surveyDataUpdated', handleUpdate)
    return () => {
      socket.off('surveyDataUpdated', handleUpdate)
    }
  }, [surveyType])

  useEffect(() => {
    let cancelled = false

    fetchSpeciesList()
      .then((data) => {
        if (!cancelled) setSpeciesStatusLookup(buildSpeciesStatusLookup(data))
      })
      .catch((err) => console.warn('Failed to fetch species list:', err))

    return () => {
      cancelled = true
    }
  }, [])

  const fieldValues = useMemo(() => buildFieldValues(locations), [locations])

  // "side" (the Directions legend) defaults to everything selected/shown, same as before.
  // The button-group filter fields default to nothing selected, meaning no restriction until
  // the user actively picks values to filter down to.
  useEffect(() => {
    setActiveValues((prev) => {
      const next = { ...prev }
      let changed = false
      for (const field of Object.keys(fieldValues)) {
        if (!(field in next)) {
          next[field] = field === 'side' ? new Set(fieldValues[field]) : new Set()
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [fieldValues])

  const toggleValue = (field, value) => {
    setActiveValues((prev) => {
      const current = new Set(prev[field] ?? [])
      if (current.has(value)) {
        current.delete(value)
      } else {
        current.add(value)
      }
      return { ...prev, [field]: current }
    })
  }

  // Clears every filter back to its default (side fully-selected, everything else unrestricted) and the search box.
  const resetFilters = () => {
    setActiveValues(buildDefaultActiveValues(fieldValues))
    setSearchQuery('')
  }

  // Blanks activeValues entirely (rather than rebuilding side-defaults from the current fieldValues) - used
  // when switching survey type, since the fieldValues-population effect above will re-seed fresh defaults
  // for the new dataset anyway.
  const clearFilters = () => {
    setActiveValues({})
    setSearchQuery('')
  }

  const filteredLocations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return locations.filter((location) => {
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
  }, [locations, activeValues, searchQuery])

  return {
    locations,
    fieldValues,
    activeValues,
    toggleValue,
    filteredLocations,
    searchQuery,
    setSearchQuery,
    resetFilters,
    clearFilters,
    speciesStatusLookup,
  }
}
