import { Component } from "react";
import { FILTERABLE_FIELDS } from "../../config/mapConfig";
import "../../css/panel.css";
import "../../css/Filters.css";

const GROUPS = ["Species", "Survey"];

class Filters extends Component {
  state = {
    activeGroup: GROUPS[0],
    activeField: null,
    isExpanded: true,
  };

  componentDidMount() {
    this.syncActiveField();
  }

  componentDidUpdate() {
    this.syncActiveField();
  }

  // Falls back to the group's first field whenever the group changes or the active field disappears (e.g. a
  // field's values load in later, or the group itself switches) so a chip row is always showing.
  syncActiveField() {
    const currentGroupFields = this.getCurrentGroupFields();
    if (!currentGroupFields.some((f) => f.field === this.state.activeField)) {
      const nextField = currentGroupFields[0]?.field ?? null;
      if (nextField !== this.state.activeField) {
        this.setState({ activeField: nextField });
      }
    }
  }

  getGroups() {
    const { fieldValues, fields = FILTERABLE_FIELDS } = this.props;
    return fields.filter(({ field }) => (fieldValues[field] || []).length > 1);
  }

  getCurrentGroupFields() {
    return this.getGroups().filter((f) => f.group === this.state.activeGroup);
  }

  render() {
    const { fieldValues, activeValues, onToggleValue, searchQuery, onSearchChange, onReset, fields = FILTERABLE_FIELDS } =
      this.props;
    const { activeGroup, activeField, isExpanded } = this.state;

    const groups = this.getGroups();

    // Built from every filterable field offered on this page (not just the currently-visible `groups`), so a
    // filter value carried over from a different section (e.g. "Keep filters" when switching survey type) still
    // shows up as a removable chip and correctly enables Reset, even if its field's tab isn't shown right now.
    const selectedChips = fields.flatMap(({ field, label }) =>
      Array.from(activeValues[field] ?? []).map((value) => ({ field, label, value }))
    );
    const availableGroups = GROUPS.filter((group) => groups.some((f) => f.group === group));
    const currentGroupFields = this.getCurrentGroupFields();
    const hasActiveFilters = selectedChips.length > 0 || searchQuery.trim().length > 0;

    const activeFieldEntry = currentGroupFields.find((f) => f.field === activeField);

    return (
      <div className="panel filters-card">
        <div className="filters-header">
          <h3>Filters</h3>
          <div className="filters-header-actions">
            <button type="button" className="filters-reset" onClick={onReset} disabled={!hasActiveFilters}>
              Reset
            </button>
            <button
              type="button"
              className="filters-collapse-toggle"
              onClick={() => this.setState({ isExpanded: !isExpanded })}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Minimize filters" : "Expand filters"}
              title={isExpanded ? "Minimize filters" : "Expand filters"}
            >
              {isExpanded ? "▲" : "▼"}
            </button>
          </div>
        </div>
        <p className="filters-hint">
          Pick a tab below, then click a chip to filter; use Reset to clear, or ▲ to minimize this panel.
        </p>

        {isExpanded && (
          <>
            <input
              type="search"
              className="filters-search"
              placeholder="Search..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search observations by any column"
            />

            {selectedChips.length > 0 && (
              <div className="filter-group">
                <span className="filter-group-label">Selected Filters</span>
                <div className="filter-chip-row">
                  {selectedChips.map(({ field, label, value }) => (
                    <button
                      type="button"
                      key={`${field}-${value}`}
                      className="filter-chip filter-chip-selected"
                      onClick={() => onToggleValue(field, value)}
                    >
                      {label}: {value} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <>
                <div className="filters-tab-row">
                  {availableGroups.map((group) => (
                    <button
                      type="button"
                      key={group}
                      className={`filters-tab${group === activeGroup ? " filters-tab-active" : ""}`}
                      onClick={() => this.setState({ activeGroup: group })}
                    >
                      {group}
                    </button>
                  ))}
                </div>

                <div className="filters-subtab-row">
                  {currentGroupFields.map(({ field, label }) => (
                    <button
                      type="button"
                      key={field}
                      className={`filters-subtab${field === activeField ? " filters-subtab-active" : ""}`}
                      onClick={() => this.setState({ activeField: field })}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {activeFieldEntry && (
                  <div className="filter-group">
                    <div className="filter-chip-row">
                      {fieldValues[activeFieldEntry.field].map((value) => {
                        const isActive = activeValues[activeFieldEntry.field]?.has(value) ?? false;
                        return (
                          <button
                            type="button"
                            key={value}
                            className={`filter-chip${isActive ? "" : " filter-chip-inactive"}`}
                            onClick={() => onToggleValue(activeFieldEntry.field, value)}
                            aria-pressed={isActive}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  }
}

export default Filters;
