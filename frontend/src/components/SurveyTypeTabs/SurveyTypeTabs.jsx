import { SURVEY_TYPES } from "../../config/mapConfig";
import "../../css/panel.css";
import "../../css/Filters.css";
import "../../css/SurveyTypeTabs.css";

// Switches between the "Data (Regular) cleaned", "Data (Rope Bridge) cleaned" and "Data (External) cleaned"
// sheets, which have meaningfully different columns (e.g. Rope Bridge/External have no reliable per-sighting GPS).
function SurveyTypeTabs({ surveyType, onChange, types = SURVEY_TYPES }) {
  return (
    <div className="panel filters-card survey-type-tabs">
      <div className="filters-tab-row">
        {types.map((type) => (
          <button
            type="button"
            key={type}
            className={`filters-tab${type === surveyType ? " filters-tab-active" : ""}`}
            onClick={() => onChange(type)}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  );
}

export default SurveyTypeTabs;
