import { Component } from "react";
import { SIDE_COLORS } from "../../config/mapConfig";
import "../../css/panel.css";

// Directional meaning of each "side of the road" bucket, relative to the surveyed stretch.
const SIDE_DESCRIPTIONS = {
  North: "Rifle Range Nature Park \u2192 ST Engineering",
  South: "ST Engineering \u2192 Rifle Range Nature Park",
  Unknown: "Side not recorded",
};

class Legend extends Component {
  render() {
    const { activeSides, onToggleSide } = this.props;
    return (
      <div className="panel">
        <h3>Directions</h3>
        <p className="legend-hint">Click a direction to show/hide it on the map.</p>
        {Object.entries(SIDE_COLORS).map(([side, color]) => {
          const isActive = activeSides.has(side);
          return (
            <button
              type="button"
              key={side}
              className={`legend-row legend-toggle${isActive ? "" : " legend-row-inactive"}`}
              onClick={() => onToggleSide(side)}
              aria-pressed={isActive}
            >
              <span className="legend-dot" style={{ backgroundColor: color }} />
              <span>
                {side}
                <span className="legend-description"> ({SIDE_DESCRIPTIONS[side]})</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }
}

export default Legend;
