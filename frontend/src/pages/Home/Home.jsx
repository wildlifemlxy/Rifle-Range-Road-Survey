import Header from '../../components/Header/Header'
import MapOverview from '../../components/MapOverview/MapOverview'
import DataOverview from '../../components/DataOverview/DataOverview'
import Legend from '../../components/Legend/Legend'
import Filters from '../../components/Filters/Filters'
import SurveyTypeTabs from '../../components/SurveyTypeTabs/SurveyTypeTabs'
import RifleRangeRoadMap from '../../components/RifleRangeRoadMap/RifleRangeRoadMap'
import ObservationDetails from '../../components/ObservationDetails/ObservationDetails'
import { ALL_SIDES } from '../../hooks/useSurveyFilters'
import { useSurveyFiltersContext } from '../../context/SurveyFiltersContext'
import { useEffect, useState } from 'react'
import '../../css/Home.css'

// Rope Bridge now has its own tab/page, so the Map page only ever deals with Regular/External.
const MAP_SURVEY_TYPES = ['Regular', 'External']

function Home() {
  const [zoom, setZoom] = useState(null)
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

  // If the shared survey type was left on "Rope Bridge" (e.g. navigating back from the Road Bridge
  // tab), fall back to Regular since this page no longer renders the rope bridge visualization.
  useEffect(() => {
    if (surveyType === 'Rope Bridge') requestSurveyTypeChange('Regular')
  }, [surveyType, requestSurveyTypeChange])

  // Most Rope Bridge sightings have no GPS coordinates (lat/lng default to 0) - drop those before
  // handing locations to the map so they don't all pile up as markers at (0, 0).
  const mappableLocations = filteredLocations.filter((location) => location.lat !== 0 || location.lng !== 0)

  return (
    <section id="map-page">
      <Header />
      <div className="overview-row">
        <MapOverview zoom={zoom} />
        <DataOverview />
        <Legend
          activeSides={activeValues.side ?? new Set(ALL_SIDES)}
          onToggleSide={(side) => toggleValue('side', side)}
        />
        <SurveyTypeTabs surveyType={surveyType} onChange={requestSurveyTypeChange} types={MAP_SURVEY_TYPES} />
        <Filters
          fieldValues={fieldValues}
          activeValues={activeValues}
          onToggleValue={toggleValue}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReset={resetFilters}
        />
      </div>
      <div className="map-row">
        <RifleRangeRoadMap
          locations={mappableLocations}
          onZoomChange={setZoom}
          onSelectLocation={setSelectedLocation}
        />
        <ObservationDetails
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          speciesStatusLookup={speciesStatusLookup}
        />
      </div>
    </section>
  )
}

export default Home
