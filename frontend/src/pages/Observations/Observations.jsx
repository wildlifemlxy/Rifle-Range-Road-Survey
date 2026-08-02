import { useState } from 'react'
import Header from '../../components/Header/Header'
import Filters from '../../components/Filters/Filters'
import SurveyTypeTabs from '../../components/SurveyTypeTabs/SurveyTypeTabs'
import ObservationsTable from '../../components/ObservationsTable/ObservationsTable'
import ObservationDetails from '../../components/ObservationDetails/ObservationDetails'
import { useSurveyFiltersContext } from '../../context/SurveyFiltersContext'
import '../../css/Observations.css'

function Observations() {
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

  return (
    <section id="observations-page">
      <Header />
      <div className="observations-filters-row">
        <SurveyTypeTabs surveyType={surveyType} onChange={requestSurveyTypeChange} />
        <Filters
          fieldValues={fieldValues}
          activeValues={activeValues}
          onToggleValue={toggleValue}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onReset={resetFilters}
        />
      </div>
      <div className="observations-row">
        <ObservationsTable locations={filteredLocations} onSelectLocation={setSelectedLocation} surveyType={surveyType} />
        <ObservationDetails
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          speciesStatusLookup={speciesStatusLookup}
        />
      </div>
    </section>
  )
}

export default Observations
