import { Component } from 'react'
import ObservationsTable from '../../../components/ObservationsTable/ObservationsTable'
import { SurveyFiltersContext } from '../../../context/SurveyFiltersContext'
import '../../../css/Dashboard.css'
import '../../../css/DataTable.css'
import '../../../css/PageLoader.css'

class DataTableSubpage extends Component {
  static contextType = SurveyFiltersContext

  render() {
    const { surveyType, filteredLocations, isLocationsLoading } = this.context

    // Guards against a flash of stale/empty rows while the shared survey type is (re)loading right
    // after switching to this tab.
    if (isLocationsLoading) {
      return <div className="subpage-loader">Loading observations...</div>
    }

    return (
      <div className="dashboard-content">
        <ObservationsTable locations={filteredLocations} surveyType={surveyType} />
      </div>
    )
  }
}

export default DataTableSubpage

