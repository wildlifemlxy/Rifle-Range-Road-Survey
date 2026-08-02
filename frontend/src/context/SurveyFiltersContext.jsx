import { createContext, useContext, useState } from 'react'
import { useSurveyFilters, ALL_SIDES } from '../hooks/useSurveyFilters'
import '../css/SurveyFiltersContext.css'

const SurveyFiltersContext = createContext(null)

// Shared across the whole app (Map and Observations pages alike) so filter selections persist when
// navigating between sections instead of resetting per-page. The only case that needs user input is
// switching survey type (Regular <-> Rope Bridge), since the two datasets' meaningful filter values
// differ - if filters are currently active, a dialog asks whether to reset them or keep them as-is.
export function SurveyFiltersProvider({ children }) {
  const [surveyType, setSurveyType] = useState('Regular')
  const [pendingSurveyType, setPendingSurveyType] = useState(null)
  const filters = useSurveyFilters(surveyType)

  const hasActiveFilters = () => {
    if (filters.searchQuery.trim() !== '') return true
    return Object.entries(filters.activeValues).some(([field, values]) => {
      if (field === 'side') return values.size !== ALL_SIDES.length
      return values.size > 0
    })
  }

  const requestSurveyTypeChange = (next) => {
    if (next === surveyType) return
    if (hasActiveFilters()) {
      setPendingSurveyType(next)
    } else {
      setSurveyType(next)
    }
  }

  const resolvePendingSwitch = (shouldReset) => {
    if (!pendingSurveyType) return
    if (shouldReset) filters.clearFilters()
    setSurveyType(pendingSurveyType)
    setPendingSurveyType(null)
  }

  return (
    <SurveyFiltersContext.Provider value={{ ...filters, surveyType, requestSurveyTypeChange }}>
      {children}
      {pendingSurveyType && (
        <div className="filter-switch-overlay" role="dialog" aria-modal="true">
          <div className="filter-switch-dialog">
            <p>
              You have active filters. Switch to <strong>{pendingSurveyType}</strong> and reset them, or
              keep your current filters?
            </p>
            <div className="filter-switch-actions">
              <button type="button" onClick={() => resolvePendingSwitch(true)}>
                Reset filters
              </button>
              <button type="button" onClick={() => resolvePendingSwitch(false)}>
                Keep filters
              </button>
            </div>
          </div>
        </div>
      )}
    </SurveyFiltersContext.Provider>
  )
}

export function useSurveyFiltersContext() {
  const context = useContext(SurveyFiltersContext)
  if (!context) throw new Error('useSurveyFiltersContext must be used within a SurveyFiltersProvider')
  return context
}
