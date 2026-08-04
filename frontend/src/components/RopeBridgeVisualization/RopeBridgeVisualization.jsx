import { Component, createRef } from "react";
import { getSpeciesImage } from "../../utils/speciesImages";
import "../../css/RopeBridgeVisualization.css";

// The horizontal span both bridges cross - the pole/deck line always runs from X_LEFT to X_RIGHT.
// Runs the full 1000-unit width (0-100%) so the pole itself matches the crossing rows' own full width,
// instead of the markers hanging off past the pole's ends.
const X_LEFT = 0;
const X_RIGHT = 1000;

const HANGER_COUNT = 9;
const TIE_COUNT = 22;
// Cropped tight to the pole itself (label + cable + deck), plus enough headroom below the deck line
// for the on-deck marker track (and its scrollbar) to never get clipped, even at the narrowest width.
const SKY_SCENE_HEIGHT = 160;

// Species-photo/paw-print lookup (see utils/speciesImages.js) rendered as a plain HTML <img>/emoji chip
// rather than pinned onto the bridge's SVG curve - crossings sit in their own horizontally-scrolling row
// per bridge below the scene, so however many there are, the row scrolls instead of the icons overlapping.
class SightingMarker extends Component {
  render() {
    const { location, subtitle, onSelectLocation } = this.props;
    const src = getSpeciesImage(location.commonName, location.scientificName);
    const title = `${location.commonName || location.scientificName || "Unidentified"} - ${subtitle}`;

    return (
      <button type="button" className="rope-bridge-marker-chip" title={title} onClick={() => onSelectLocation(location)}>
        {src ? (
          <img className="rope-bridge-marker-chip-image" src={src} alt="" />
        ) : (
          <span className="rope-bridge-marker-chip-default" aria-hidden="true">
            🐾
          </span>
        )}
      </button>
    );
  }
}

// Native OS/browser scrollbars can render as an invisible "overlay" that only appears on hover or while
// actively scrolling, so the track draws its own always-visible, directly-draggable bar underneath - kept
// in sync with the real scroll position/extent via a scroll listener + ResizeObserver, and it can also
// drive the scroll position itself (click-to-jump + drag) so users never need to hover the bridge/chips.
class MarkerTrack extends Component {
  trackRef = createRef();
  barRef = createRef();
  dragState = null;

  state = { scrollBar: { ratio: 1, offset: 0 } };

  componentDidMount() {
    this.attachTrackObservers();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.locations.length !== this.props.locations.length) {
      this.attachTrackObservers();
    }
  }

  componentWillUnmount() {
    this.detachTrackObservers?.();
  }

  attachTrackObservers() {
    this.detachTrackObservers?.();

    const el = this.trackRef.current;
    if (!el) return;

    this.syncScrollBar();
    el.addEventListener("scroll", this.syncScrollBar, { passive: true });
    const observer = new ResizeObserver(this.syncScrollBar);
    observer.observe(el);
    this.detachTrackObservers = () => {
      el.removeEventListener("scroll", this.syncScrollBar);
      observer.disconnect();
    };
  }

  syncScrollBar = () => {
    const el = this.trackRef.current;
    if (!el) return;
    const { scrollWidth, clientWidth, scrollLeft } = el;
    const ratio = scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1;
    const maxScrollLeft = scrollWidth - clientWidth;
    const offset = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
    this.setState({ scrollBar: { ratio, offset } });
  };

  // Converts a pointer's clientX into a track scrollLeft, treating clientX as where the thumb's CENTER
  // should land - this is what makes click-to-jump feel natural instead of snapping the thumb's edge to it.
  scrollToClientX = (clientX) => {
    const track = this.trackRef.current;
    const bar = this.barRef.current;
    if (!track || !bar) return;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    if (maxScrollLeft <= 0) return;
    const barRect = bar.getBoundingClientRect();
    const thumbWidthPx = barRect.width * this.state.scrollBar.ratio;
    const usableWidth = barRect.width - thumbWidthPx;
    const targetThumbLeft = clientX - barRect.left - thumbWidthPx / 2;
    const ratio = usableWidth > 0 ? Math.min(1, Math.max(0, targetThumbLeft / usableWidth)) : 0;
    track.scrollLeft = ratio * maxScrollLeft;
  };

  handleBarPointerDown = (event) => {
    const track = this.trackRef.current;
    if (!track || track.scrollWidth - track.clientWidth <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    this.dragState = { pointerId: event.pointerId };
    this.scrollToClientX(event.clientX);
  };

  handleBarPointerMove = (event) => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
    this.scrollToClientX(event.clientX);
  };

  handleBarPointerUp = (event) => {
    if (!this.dragState || this.dragState.pointerId !== event.pointerId) return;
    this.dragState = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  render() {
    const { title, locations, onSelectLocation, subtitle } = this.props;
    const { scrollBar } = this.state;
    const thumbWidthPercent = scrollBar.ratio * 100;
    const thumbTravelPercent = 100 - thumbWidthPercent;
    const canScroll = scrollBar.ratio < 0.999;

    return (
      <div className="rope-bridge-marker-track-wrap">
        <div className="rope-bridge-marker-track" ref={this.trackRef}>
          {locations.map((location, index) => (
            <SightingMarker
              key={`${title}-${index}-${location.surveyId}-${location.scientificName}`}
              location={location}
              subtitle={subtitle}
              onSelectLocation={onSelectLocation}
            />
          ))}
        </div>
        {canScroll && (
          <div
            className="rope-bridge-marker-scrollbar"
            ref={this.barRef}
            role="scrollbar"
            aria-orientation="horizontal"
            aria-valuenow={Math.round(scrollBar.offset * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            onPointerDown={this.handleBarPointerDown}
            onPointerMove={this.handleBarPointerMove}
            onPointerUp={this.handleBarPointerUp}
            onPointerCancel={this.handleBarPointerUp}
          >
            <div
              className="rope-bridge-marker-scrollbar-thumb"
              style={{ width: `${thumbWidthPercent}%`, left: `${scrollBar.offset * thumbTravelPercent}%` }}
            />
          </div>
        )}
      </div>
    );
  }
}

// A titled row wrapping a MarkerTrack - used for off-bridge/unspecified sightings, which have no bridge
// illustration to overlap. Mirrors the on-bridge rows' own outer scroll + fixed min-width + deck-aligned
// inset, so its title and marker strip line up under the same position/width as the bridges' own
// "Bridge A"/"Bridge B" labels and crossing rows.
class MarkerRow extends Component {
  render() {
    const { title, locations, onSelectLocation, subtitle } = this.props;
    return (
      <div className="rope-bridge-marker-group">
        <div className="rope-bridge-scene-scroll">
          <div className="rope-bridge-marker-group-body">
            <h4 className="rope-bridge-marker-group-title">{title}</h4>
            <MarkerTrack title={title} locations={locations} subtitle={subtitle} onSelectLocation={onSelectLocation} />
          </div>
        </div>
      </div>
    );
  }
}

// The same scrollable strip, laid directly over the bridge deck - so the markers visually sit on the
// bridge itself while still scrolling to reveal every sighting without any of them overlapping each other.
class MarkerDeckOverlay extends Component {
  render() {
    const { title, locations, onSelectLocation, subtitle } = this.props;
    return (
      <div className="rope-bridge-deck-overlay">
        <MarkerTrack title={title} locations={locations} subtitle={subtitle} onSelectLocation={onSelectLocation} />
      </div>
    );
  }
}

// Just the pole: a straight cable, a straight deck line below it, the hangers/ties connecting them, and
// an upright anchor post at each end where the cable/deck actually terminate - no path curves, no
// canopy artwork, nothing drawn behind it.
class BridgeSpan extends Component {
  render() {
    const { id, label, anchorY, postGradientId } = this.props;
    const deckY = anchorY + 22;
    // Inset a few units from the viewBox's own left/right edges so each post's stroke isn't half-clipped
    // by the SVG's edge (X_LEFT/X_RIGHT now run flush to 0/1000 to match the full-width crossing rows).
    const postInset = 8;
    const postTopY = anchorY - 26;
    const postBottomY = deckY + 14;

    const hangers = Array.from({ length: HANGER_COUNT }, (_, i) => {
      const t = 0.08 + (i / (HANGER_COUNT - 1)) * 0.84;
      const x = X_LEFT + t * (X_RIGHT - X_LEFT);
      return { x, key: `${id}-hanger-${i}` };
    });

    const ties = Array.from({ length: TIE_COUNT }, (_, i) => {
      const t = 0.03 + (i / (TIE_COUNT - 1)) * 0.94;
      const x = X_LEFT + t * (X_RIGHT - X_LEFT);
      return { x, key: `${id}-tie-${i}` };
    });

    // A thin off-center highlight line down each post (solid, not gradient-filled) reads as a glint of
    // light on a round wooden post, giving the thick flat stroke some cylindrical depth.
    const postHighlightOffset = 2;

    return (
      <g className="rope-bridge-span">
        <line
          className="rope-bridge-post"
          stroke={`url(#${postGradientId})`}
          x1={X_LEFT + postInset}
          y1={postTopY}
          x2={X_LEFT + postInset}
          y2={postBottomY}
        />
        <line
          className="rope-bridge-post-highlight"
          x1={X_LEFT + postInset - postHighlightOffset}
          y1={postTopY}
          x2={X_LEFT + postInset - postHighlightOffset}
          y2={postBottomY}
        />
        <line
          className="rope-bridge-post"
          stroke={`url(#${postGradientId})`}
          x1={X_RIGHT - postInset}
          y1={postTopY}
          x2={X_RIGHT - postInset}
          y2={postBottomY}
        />
        <line
          className="rope-bridge-post-highlight"
          x1={X_RIGHT - postInset - postHighlightOffset}
          y1={postTopY}
          x2={X_RIGHT - postInset - postHighlightOffset}
          y2={postBottomY}
        />

        <line className="rope-bridge-cable" x1={X_LEFT} y1={anchorY} x2={X_RIGHT} y2={anchorY} />

        <g className="rope-bridge-sway">
          {hangers.map(({ x, key }) => (
            <line key={key} className="rope-bridge-hanger" x1={x} y1={anchorY} x2={x} y2={deckY} />
          ))}

          <line className="rope-bridge-deck" x1={X_LEFT} y1={deckY} x2={X_RIGHT} y2={deckY} />

          {ties.map(({ x, key }) => (
            <line key={key} className="rope-bridge-deck-tie" x1={x} y1={deckY - 4} x2={x} y2={deckY + 4} />
          ))}
        </g>

        <text className="rope-bridge-label" x={X_LEFT + postInset + 14} y={anchorY - 18}>
          {label}
        </text>
      </g>
    );
  }
}

// A single bridge's own scene, sized so it can stand alone with its own crossings row directly
// beneath it, instead of both bridges sharing one combined picture.
class BridgeScene extends Component {
  render() {
    const { id, label, anchorY } = this.props;
    const postGradientId = `rope-bridge-post-gradient-${id}`;
    return (
      <svg className="rope-bridge-svg" viewBox={`0 0 1000 ${SKY_SCENE_HEIGHT}`} role="img" aria-label={`${label} crossings`}>
        <defs>
          {/* Wood-brown post gradient (top to bottom, lighter grain streaks over a dark base) instead of a
              flat single color - each end post is its own gradient instance (unique id per bridge) since
              duplicate SVG ids in one document would clash. userSpaceOnUse (not the default
              objectBoundingBox) because a purely vertical <line> has a zero-width bounding box, which makes
              an objectBoundingBox gradient's transform singular and silently un-rendered - userSpaceOnUse
              instead maps the stops directly to the viewBox's own y-coordinates, matching each post's
              actual top/bottom. */}
          <linearGradient id={postGradientId} gradientUnits="userSpaceOnUse" x1="0" y1={anchorY - 26} x2="0" y2={anchorY + 36}>
            <stop offset="0%" stopColor="#6b4423" />
            <stop offset="25%" stopColor="#8b5a2b" />
            <stop offset="50%" stopColor="#5c3a1a" />
            <stop offset="75%" stopColor="#7a4a23" />
            <stop offset="100%" stopColor="#4a2f18" />
          </linearGradient>
        </defs>
        <BridgeSpan id={id} label={label} anchorY={anchorY} postGradientId={postGradientId} />
      </svg>
    );
  }
}

class RopeBridgeVisualization extends Component {
  render() {
    const { locations, onSelectLocation } = this.props;
    const bridgeA = locations.filter((location) => location.ropeBridgeId === "A");
    const bridgeB = locations.filter((location) => location.ropeBridgeId === "B");
    // Anything not logged against bridge "A" or "B" specifically (including blank/malformed Rope Bridge
    // ID values) - i.e. still bucketed purely off that column, same as the two spans above.
    const unassigned = locations.filter((location) => location.ropeBridgeId !== "A" && location.ropeBridgeId !== "B");

    return (
      <div className="rope-bridge-viz panel">
        {/* Both bridges live together inside one shared scene block, each stage still followed
            immediately by its own crossings row, so "Bridge A crossings" always sits directly under the
            Bridge A pole, and likewise for Bridge B. */}
        <div className="rope-bridge-scene-block">
          <div className="rope-bridge-scene-scroll">
            <div className="rope-bridge-stage">
              <BridgeScene id="bridge-a" label="Bridge A" anchorY={50} />
              <MarkerDeckOverlay
                title="Bridge A crossings"
                locations={bridgeA}
                subtitle="Bridge A crossing"
                onSelectLocation={onSelectLocation}
              />
            </div>
          </div>

          <div className="rope-bridge-scene-scroll">
            <div className="rope-bridge-stage">
              <BridgeScene id="bridge-b" label="Bridge B" anchorY={50} />
              <MarkerDeckOverlay
                title="Bridge B crossings"
                locations={bridgeB}
                subtitle="Bridge B crossing"
                onSelectLocation={onSelectLocation}
              />
            </div>
          </div>
        </div>

        <MarkerRow
          title="Off-bridge / unspecified sightings"
          locations={unassigned}
          subtitle="off-bridge sighting"
          onSelectLocation={onSelectLocation}
        />

        {locations.length === 0 && (
          <div className="rope-bridge-empty-overlay">No rope bridge crossings match the current filters.</div>
        )}
      </div>
    );
  }
}

export default RopeBridgeVisualization;
