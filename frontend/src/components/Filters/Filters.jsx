import { useEffect, useState } from "react";
import { FILTERABLE_FIELDS } from "../../config/mapConfig";
import "../../css/panel.css";
import "../../css/Filters.css";

const GROUPS = ["Species", "Survey"];

function Filters({ fieldValues, activeValues, onToggleValue, searchQuery, onSearchChange, onReset, fields = FILTERABLE_FIELDS }) {
  const [activeGroup, setActiveGroup] = useState(GROUPS[0]);
  const [activeField, setActiveField] = useState(null);

  const groups = fields.filter(({ field }) => (fieldValues[field] || []).length > 1);

  // Built from every filterable field offered on this page (not just the currently-visible `groups`), so a
  // filter value carried over from a different section (e.g. "Keep filters" when switching survey type) still
  // shows up as a removable chip and correctly enables Reset, even if its field's tab isn't shown right now.
  const selectedChips = fields.flatMap(({ field, label }) =>
    Array.from(activeValues[field] ?? []).map((value) => ({ field, label, value }))
  );
  const availableGroups = GROUPS.filter((group) => groups.some((f) => f.group === group));
  const currentGroupFields = groups.filter((f) => f.group === activeGroup);
  const hasActiveFilters = selectedChips.length > 0 || searchQuery.trim().length > 0;

  // Falls back to the group's first field whenever the group changes or the active field disappears (e.g. a
  // field's values load in later, or the group itself switches) so a chip row is always showing.
  useEffect(() => {
    if (!currentGroupFields.some((f) => f.field === activeField)) {
      setActiveField(currentGroupFields[0]?.field ?? null);
    }
  }, [currentGroupFields, activeField]);

  const activeFieldEntry = currentGroupFields.find((f) => f.field === activeField);

  return (
    <div className="panel filters-card">
      <div className="filters-header">
        <h3>Filters</h3>
        <button type="button" className="filters-reset" onClick={onReset} disabled={!hasActiveFilters}>
          Reset
        </button>
      </div>

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
                onClick={() => setActiveGroup(group)}
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
                onClick={() => setActiveField(field)}
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
    </div>
  );
}

export default Filters;
