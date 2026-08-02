import { useEffect, useState } from "react";
import { SIDE_COLORS } from "../../config/mapConfig";
import "../../css/ObservationDetails.css";

const TABS = ["Overview", "Survey", "Location"];

// Every remaining sheet column, grouped into tabs so the panel doesn't cram everything into one long list.
// Fields blank for the current observation are hidden (see the .filter(Boolean) render below), so the
// Rope-Bridge-only fields (Crossing Type, On Rope Bridge?, Rope Bridge ID) simply don't show up for
// Regular rows, and vice versa for Taxa/Roadkill?/Coords/Nearest Landmarks.
const TAB_FIELDS = {
  Overview: [
    { label: "Taxa", get: (l) => l.taxa },
    { label: "Crossing Type", get: (l) => l.crossingType },
    { label: "Target Species", get: (l) => l.targetSpecies },
    { label: "Identified?", get: (l) => l.identified },
    { label: "Count", get: (l) => String(l.count || "") },
    { label: "Roadkill?", get: (l) => l.isRoadkill },
    { label: "On Rope Bridge?", get: (l) => l.onRopeBridge },
  ],
  Survey: [
    { label: "Surveyors", get: (l) => l.surveyors },
    { label: "Survey ID", get: (l) => l.surveyId },
    { label: "Survey Date", get: (l) => l.surveyDate },
    { label: "Survey Start Time", get: (l) => l.surveyStartTime },
    { label: "Survey End Time", get: (l) => l.surveyEndTime },
    { label: "Time of Observation", get: (l) => l.timeOfObservation },
    { label: "Weather Conditions", get: (l) => l.weatherConditions },
    { label: "Survey Direction", get: (l) => l.surveyDirection },
    { label: "Side (L/R/On road)", get: (l) => l.sideLR },
  ],
  Location: [
    { label: "iNat Username", get: (l) => l.inatUsername },
    { label: "Coords / Nearest Landmarks", get: (l) => l.coordsNearestLandmarks },
    { label: "Rope Bridge ID", get: (l) => l.ropeBridgeId },
    // Most Rope Bridge rows have no real per-sighting GPS (lat/lng default to 0) - hide rather than
    // showing a misleading "0.000000, 0.000000".
    { label: "Coordinates", get: (l) => (l.lat === 0 && l.lng === 0 ? "" : `${l.lat.toFixed(6)}, ${l.lng.toFixed(6)}`) },
  ],
};

function ObservationDetails({ location, onClose, speciesStatusLookup }) {
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");
  // Holds the observation actually being displayed - only swapped to `location` once its image (if
  // any) has finished loading, so switching between observations never flashes a broken/mismatched image.
  const [displayedLocation, setDisplayedLocation] = useState(location);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    // Closing the panel, or having nothing to wait on, applies immediately.
    if (!location || !location.imageUrl) {
      setDisplayedLocation(location);
      setActiveTab("Overview");
      setIsSwitching(false);
      return;
    }

    // Only gate on the image preload when swapping from an already-open observation to another -
    // that's the case that can flash a stale/mismatched image. Opening the panel from closed shows
    // immediately (there's nothing previous on screen to protect), same as before.
    // (Intentionally reading `displayedLocation` here without listing it as a dependency: it should
    // reflect the value from before this change, not re-run this effect on its own updates.)
    if (!displayedLocation) {
      setDisplayedLocation(location);
      setActiveTab("Overview");
      setIsSwitching(false);
      return;
    }

    setIsSwitching(true);
    let cancelled = false;
    const preload = new Image();
    const finish = () => {
      if (cancelled) return;
      setDisplayedLocation(location);
      setActiveTab("Overview");
      setIsSwitching(false);
    };
    preload.onload = finish;
    preload.onerror = finish;
    preload.src = location.imageUrl;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  if (!displayedLocation) return null;

  const title = displayedLocation.commonName || displayedLocation.scientificName || "Observation";
  const status = speciesStatusLookup.get(displayedLocation.scientificName.trim().toLowerCase());

  return (
    <div className={`observation-details${isSwitching ? " observation-details-switching" : ""}`}>
      <div className="observation-details-header">
        <h3>{title}</h3>
        <button className="observation-details-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {displayedLocation.commonName && displayedLocation.scientificName && (
        <p className="observation-details-subtitle">{displayedLocation.scientificName}</p>
      )}

      {displayedLocation.imageUrl && (
        <div className="observation-details-image-wrap">
          <img className="observation-details-image" src={displayedLocation.imageUrl} alt={title} loading="lazy" />
          <button
            type="button"
            className="observation-details-image-expand"
            onClick={() => setIsImageFullscreen(true)}
            aria-label="View image full screen"
          >
            ⛶
          </button>
        </div>
      )}

      {(status?.srdb3Status || status?.iucnStatus) && (
        <div className="observation-details-status-row">
          {status?.srdb3Status && (
            <div className="observation-details-field">
              <span className="observation-details-label">SRDB3 Status</span>
              <p className="observation-details-status-value">{status.srdb3Status}</p>
            </div>
          )}
          {status?.iucnStatus && (
            <div className="observation-details-field">
              <span className="observation-details-label">IUCN Status</span>
              <p className="observation-details-status-value">{status.iucnStatus}</p>
            </div>
          )}
        </div>
      )}

      <div className="observation-details-tab-row">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`observation-details-tab${activeTab === tab ? " observation-details-tab-active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="observation-details-grid">
        {activeTab === "Location" && (
          <div className="observation-details-field">
            <span className="observation-details-label">Side of Road</span>
            <p style={{ color: SIDE_COLORS[displayedLocation.side] }}>{displayedLocation.side}</p>
          </div>
        )}
        {TAB_FIELDS[activeTab].map(({ label, get }) => {
          const value = get(displayedLocation);
          if (!value) return null;
          return (
            <div className="observation-details-field" key={label}>
              <span className="observation-details-label">{label}</span>
              <p>{value}</p>
            </div>
          );
        })}
      </div>

      {activeTab === "Overview" && displayedLocation.remarks && (
        <div className="observation-details-remarks">
          <span className="observation-details-label">Behaviours / Remarks</span>
          <p>{displayedLocation.remarks}</p>
        </div>
      )}

      {isImageFullscreen && displayedLocation.imageUrl && (
        <div className="observation-details-lightbox" onClick={() => setIsImageFullscreen(false)}>
          <button
            type="button"
            className="observation-details-lightbox-close"
            onClick={() => setIsImageFullscreen(false)}
            aria-label="Close full screen image"
          >
            ×
          </button>
          <img src={displayedLocation.imageUrl} alt={title} className="observation-details-lightbox-image" />
        </div>
      )}
    </div>
  );
}

export default ObservationDetails;
