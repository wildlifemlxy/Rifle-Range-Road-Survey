import { Component, createRef } from "react";
import { MarkerClusterer, SuperClusterAlgorithm } from "@googlemaps/markerclusterer";
import { fetchMapApiKey, SURVEY_SEGMENT_BOUNDS, DEFAULT_ZOOM, SIDE_COLORS } from "../../config/mapConfig";

// Map's own max zoom; kept above the algorithm's maxZoom so a few final levels always show loose individual pins.
const MAP_MAX_ZOOM = 25;

// Classic map-pin (teardrop) SVG path, 24x24 viewBox. Arc flags need explicit spaces or Google's path parser chokes.
const PIN_PATH =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0 -5a2.5 2.5 0 0 1 0 5z";

// Cluster bubble colors tiered by how many observations they group together.
const clusterColor = (count) => {
  if (count >= 20) return "#ea4335";
  if (count >= 8) return "#fbbc04";
  return "#34a853";
};

const loadGoogleMapsScript = (apiKey) => {
  if (window.google?.maps) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps API")));
    });
  }

  return new Promise((resolve, reject) => {
    window.__initGoogleMaps = () => resolve();

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps API"));
    document.head.appendChild(script);
  });
};

class RifleRangeRoadMap extends Component {
  mapContainerRef = createRef();
  mapRef = { current: null };
  clustererRef = { current: null };

  state = {
    error: null,
    mapReady: false,
  };

  componentDidMount() {
    this._unmounted = false;
    this.initializeMap();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.locations !== this.props.locations || prevState.mapReady !== this.state.mapReady) {
      this.syncMarkers();
    }
  }

  componentWillUnmount() {
    this._unmounted = true;
  }

  // Initializes the Google Map exactly once; markers are synced separately (via syncMarkers) whenever
  // `locations` changes.
  async initializeMap() {
    try {
      const apiKey = await fetchMapApiKey();
      if (!apiKey) throw new Error("Google Maps API key not configured");

      await loadGoogleMapsScript(apiKey);
      if (this._unmounted || !this.mapContainerRef.current || this.mapRef.current) return;

      const segmentBounds = new window.google.maps.LatLngBounds(
        { lat: SURVEY_SEGMENT_BOUNDS.south, lng: SURVEY_SEGMENT_BOUNDS.west },
        { lat: SURVEY_SEGMENT_BOUNDS.north, lng: SURVEY_SEGMENT_BOUNDS.east }
      );

      const map = new window.google.maps.Map(this.mapContainerRef.current, {
        center: segmentBounds.getCenter(),
        zoom: DEFAULT_ZOOM,
        mapTypeId: window.google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: window.google.maps.ControlPosition.TOP_RIGHT,
        },
        // DEFAULT_ZOOM (15) is also the floor - users can zoom in and drag freely, just not out
        // past the initial view.
        minZoom: DEFAULT_ZOOM,
        maxZoom: MAP_MAX_ZOOM,
        isFractionalZoomEnabled: false,
        // Locks panning to the default survey-segment area - strictBounds is deliberately false,
        // since setting it true makes Maps auto-adjust (increase) zoom to keep the full bounds
        // filling the viewport, which was overriding DEFAULT_ZOOM.
        restriction: {
          latLngBounds: segmentBounds,
          strictBounds: false,
        },
        // Prevents Google's own POI markers (parks, buildings, etc.) from opening info windows on click.
        clickableIcons: false,
      });

      // Center/zoom are already set explicitly above (center: segmentBounds.getCenter(), zoom:
      // DEFAULT_ZOOM) - deliberately NOT calling map.fitBounds(segmentBounds) here, since fitBounds
      // recalculates and overrides the zoom to whatever fits the bounds tightly (was silently bumping
      // the effective zoom to 17 despite DEFAULT_ZOOM being 15).

      this.props.onZoomChange?.(map.getZoom());
      map.addListener("zoom_changed", () => this.props.onZoomChange?.(map.getZoom()));

      this.mapRef.current = map;
      // Clicking a cluster steps the zoom in gradually so intermediate sub-clusters
      // stay visible instead of jumping straight to all-individual pins.
      this.clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        algorithm: new SuperClusterAlgorithm({
          radius: 60,
          // Keep clustering active almost all the way up so sub-clusters persist across zoom levels.
          maxZoom: MAP_MAX_ZOOM - 2,
        }),
        onClusterClick: (_event, cluster, map) => {
          const currentZoom = map.getZoom() ?? DEFAULT_ZOOM;
          const targetZoom = Math.min(currentZoom + 2, MAP_MAX_ZOOM);
          map.setCenter(cluster.position);
          map.setZoom(targetZoom);
        },
        renderer: {
          render: ({ count, position }) => {
            const color = clusterColor(count);
            const svg = window.btoa(
              `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">` +
                `<circle cx="22" cy="22" r="20" fill="${color}" fill-opacity="0.9" stroke="#ffffff" stroke-width="2"/>` +
                `</svg>`
            );
            return new window.google.maps.Marker({
              position,
              icon: {
                url: `data:image/svg+xml;base64,${svg}`,
                scaledSize: new window.google.maps.Size(44, 44),
              },
              label: { text: String(count), color: "#ffffff", fontSize: "13px", fontWeight: "700" },
              zIndex: 1000 + count,
            });
          },
        },
      });
      this.setState({ mapReady: true });
    } catch (err) {
      if (!this._unmounted) {
        console.error(err);
        this.setState({ error: err instanceof Error ? err.message : "Failed to load map" });
      }
    }
  }

  // Rebuilds pins whenever the (already-filtered) location list changes.
  syncMarkers() {
    const clusterer = this.clustererRef.current;
    if (!clusterer || !this.state.mapReady) return;

    const markers = this.props.locations.map((location) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        icon: {
          path: PIN_PATH,
          fillColor: SIDE_COLORS[location.side],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.6,
          anchor: new window.google.maps.Point(12, 22),
        },
      });
      // Individual (non-clustered) pins open the detail panel; clusters just zoom in.
      marker.addListener("click", () => this.props.onSelectLocation?.(location));
      return marker;
    });

    clusterer.clearMarkers();
    clusterer.addMarkers(markers);
  }

  render() {
    if (this.state.error) {
      return <div className="map-error">{this.state.error}</div>;
    }

    return <div className="map-container" ref={this.mapContainerRef} />;
  }
}

export default RifleRangeRoadMap;
