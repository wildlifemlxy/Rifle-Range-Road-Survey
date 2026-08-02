import { useEffect, useState } from 'react'
import Header from '../../components/Header/Header'
import DataOverview from '../../components/DataOverview/DataOverview'
import Filters from '../../components/Filters/Filters'
import RopeBridgeVisualization from '../../components/RopeBridgeVisualization/RopeBridgeVisualization'
import ObservationDetails from '../../components/ObservationDetails/ObservationDetails'
import { ROPE_BRIDGE_FILTERABLE_FIELDS } from '../../config/mapConfig'
import { useSurveyFiltersContext } from '../../context/SurveyFiltersContext'
import '../../css/RoadBridge.css'

function RoadBridge() {
  const [selectedLocation, setSelectedLocation] = useState(null)
  const {
    surveyType,
    requestSurveyTypeChange,
    fieldValues,
    activeValues,
    toggleValue,
    filteredLocations,
    searchQuery,
    setSearchQuery,
    resetFilters,
    speciesStatusLookup,
  } = useSurveyFiltersContext()

  // This page always shows Rope Bridge data, regardless of whichever type was last active elsewhere.
  useEffect(() => {
    if (surveyType !== 'Rope Bridge') requestSurveyTypeChange('Rope Bridge')
  }, [surveyType, requestSurveyTypeChange])

  return (
    <section id="road-bridge-page">
      <Header />
      <div className="overview-row">
        <DataOverview />
        <Filters
          fieldValues={fieldValues}
          activeValues={activeValues}
          onToggleValue={toggleValue}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReset={resetFilters}
          fields={ROPE_BRIDGE_FILTERABLE_FIELDS}
        />
      </div>
      <div className="map-row">
        <RopeBridgeVisualization locations={filteredLocations} onSelectLocation={setSelectedLocation} />
        <ObservationDetails
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          speciesStatusLookup={speciesStatusLookup}
        />
      </div>
    </section>
  )
}

export default RoadBridge
