import { Component } from 'react'
import MapOverview from '../../../components/MapOverview/MapOverview'
import DataOverview from '../../../components/DataOverview/DataOverview'
import Legend from '../../../components/Legend/Legend'
import RifleRangeRoadMap from '../../../components/RifleRangeRoadMap/RifleRangeRoadMap'
import RopeBridgeVisualization from '../../../components/RopeBridgeVisualization/RopeBridgeVisualization'
import ObservationDetails from '../../../components/ObservationDetails/ObservationDetails'
import { ALL_SIDES, SurveyFiltersContext } from '../../../context/SurveyFiltersContext'
import '../../../css/Dashboard.css'
import '../../../css/Observations.css'
import '../../../css/PageLoader.css'

// Merges the old separate Map and Road Bridge tabs into one "Observations" tab - which view shows is
// derived directly from the shared filter bar's survey type (Rope Bridge sightings have no per-sighting
// GPS, so they get their own visualization) instead of a separate page-local view toggle.
class ObservationsSubpage extends Component {
  static contextType = SurveyFiltersContext

  state = {
    zoom: null,
    selectedMapLocation: null,
    selectedBridgeLocation: null,
  }

  setZoom = (zoom) => this.setState({ zoom })
  setSelectedMapLocation = (selectedMapLocation) => this.setState({ selectedMapLocation })
  setSelectedBridgeLocation = (selectedBridgeLocation) => this.setState({ selectedBridgeLocation })

  renderMapView() {
    const { activeValues, toggleValue, filteredLocations, speciesStatusLookup } = this.context
    const { zoom, selectedMapLocation } = this.state

    // Most Rope Bridge sightings have no GPS coordinates (lat/lng default to 0) - moot here since this
    // sub-view never shows Rope Bridge data, but kept for parity with the old MapSubpage's guard.
    const mappableLocations = filteredLocations.filter((location) => location.lat !== 0 || location.lng !== 0)

    return (
      <div className="dashboard-content">
        <div className="overview-row">
          <MapOverview zoom={zoom} />
          <DataOverview />
          <Legend
            activeSides={activeValues.side ?? new Set(ALL_SIDES)}
            onToggleSide={(side) => toggleValue('side', side)}
          />
        </div>
        <div className="map-row">
          <RifleRangeRoadMap
            locations={mappableLocations}
            onZoomChange={this.setZoom}
            onSelectLocation={this.setSelectedMapLocation}
          />
          <ObservationDetails
            location={selectedMapLocation}
            onClose={() => this.setSelectedMapLocation(null)}
            speciesStatusLookup={speciesStatusLookup}
          />
        </div>
      </div>
    )
  }

  renderRoadBridgeView() {
    const { filteredLocations, speciesStatusLookup } = this.context
    const { selectedBridgeLocation } = this.state

    return (
      <div className="dashboard-content">
        <div className="overview-row">
          <DataOverview />
        </div>
        <div className="map-row">
          <RopeBridgeVisualization locations={filteredLocations} onSelectLocation={this.setSelectedBridgeLocation} />
          <ObservationDetails
            location={selectedBridgeLocation}
            onClose={() => this.setSelectedBridgeLocation(null)}
            speciesStatusLookup={speciesStatusLookup}
          />
        </div>
      </div>
    )
  }

  render() {
    const { surveyType, isLocationsLoading } = this.context

    if (isLocationsLoading) {
      return <div className="subpage-loader">Loading observations...</div>
    }

    return surveyType === 'Rope Bridge' ? this.renderRoadBridgeView() : this.renderMapView()
  }
}

export default ObservationsSubpage
