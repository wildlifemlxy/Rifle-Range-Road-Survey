import { Component } from "react";
import { buildSurveySummaryItems } from "../../config/mapConfig";
import { SurveyFiltersContext } from "../../context/SurveyFiltersContext";
import "../../css/panel.css";

// Computed from the shared filter bar's filteredLocations so this panel's stats always match whatever
// survey type/filters/search are active everywhere else in the app, instead of a separate unfiltered
// backend fetch.
class DataOverview extends Component {
  static contextType = SurveyFiltersContext;

  render() {
    const { filteredLocations, isLocationsLoading } = this.context;
    const summary = isLocationsLoading ? null : buildSurveySummaryItems(filteredLocations);

    return (
      <div className="panel">
        <h3>Data Overview</h3>
        {!summary && <p>Loading...</p>}
        {summary && (
          <>
            {summary.items.map(({ label, value }) => (
              <p key={label}>
                <strong>{label}:</strong> {value}
              </p>
            ))}
          </>
        )}
      </div>
    );
  }
}

export default DataOverview;
