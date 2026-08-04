import { Component } from "react";
import { SURVEY_TYPES } from "../../config/mapConfig";
import "../../css/panel.css";
import "../../css/Filters.css";
import "../../css/SurveyTypeTabs.css";

// "Regular"/"External" are both map-based (per-sighting GPS), so on the Observations tab they're grouped
// under a "Maps" tab with a second-level Regular/External choice, next to a "Road Bridge Den" tab (Rope
// Bridge has no reliable per-sighting GPS and gets its own visualization instead of a map).
const MAP_TYPES = ["Regular", "External"];

class SurveyTypeTabs extends Component {
  // Tracks whether the Maps sub-choice is expanded separately from `surveyType`, so clicking "Maps"
  // reveals the Regular/External choice first instead of immediately jumping to a default selection.
  // `defaultExpanded` lets a caller start the whole menu collapsed instead (defaults to expanded).
  state = {
    isMapsExpanded: this.props.surveyType !== "Rope Bridge",
    isExpanded: this.props.defaultExpanded ?? true,
  };

  toggleExpanded = () => {
    this.setState((prev) => ({ isExpanded: !prev.isExpanded }));
  };

  handleMapsClick = () => {
    this.setState({ isMapsExpanded: true });
  };

  handleRoadBridgeClick = () => {
    this.setState({ isMapsExpanded: false });
    this.props.onChange("Rope Bridge");
  };

  renderGrouped() {
    const { surveyType, onChange } = this.props;
    const { isMapsExpanded } = this.state;

    return (
      <div className="filters-tab-row">
        <button
          type="button"
          className={`filters-tab${isMapsExpanded ? " filters-tab-active" : ""}`}
          onClick={this.handleMapsClick}
        >
          Maps
        </button>
        {/* Nested directly under "Maps" (before the "Road Bridge" sibling) so the vertical menu reads
            as Maps > Regular/External rather than Road Bridge > Regular/External. */}
        {isMapsExpanded && (
          <div className="filters-subtab-row survey-type-subtabs">
            {MAP_TYPES.map((type) => (
              <button
                type="button"
                key={type}
                className={`filters-subtab${type === surveyType ? " filters-subtab-active" : ""}`}
                onClick={() => onChange(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={`filters-tab${isMapsExpanded ? "" : " filters-tab-active"}`}
          onClick={this.handleRoadBridgeClick}
        >
          Road Bridge
        </button>
      </div>
    );
  }

  renderFlat() {
    const { surveyType, onChange, types = SURVEY_TYPES } = this.props;

    return (
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
    );
  }

  render() {
    const { grouped, children } = this.props;
    const { isExpanded } = this.state;

    return (
      <div className={`panel survey-type-tabs${isExpanded ? "" : " survey-type-tabs-collapsed"}`}>
        <div className="survey-type-tabs-header">
          {isExpanded && <h3>Survey Type</h3>}
          <button
            type="button"
            className="survey-type-tabs-collapse-toggle"
            onClick={this.toggleExpanded}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse survey type menu" : "Expand survey type menu"}
            title={isExpanded ? "Collapse survey type menu" : "Expand survey type menu"}
          >
            {isExpanded ? "◀" : "▶"}
          </button>
        </div>
        {/* Collapsing unmounts the tabs entirely (rather than just squeezing them) since the whole
            sidebar column also slides down to a slim strip - see `.dashboard-page-menu:has(...)` in
            Dashboard.css - so there's no squeezed content left to animate independently in here. */}
        {isExpanded && (
          <div className="survey-type-tabs-body">
            {grouped ? this.renderGrouped() : this.renderFlat()}
            {children}
          </div>
        )}
      </div>
    );
  }
}

export default SurveyTypeTabs;
