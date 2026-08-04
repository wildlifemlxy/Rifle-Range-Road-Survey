import { Component } from "react";
import { MAP_TYPE_LABEL } from "../../config/mapConfig";
import "../../css/panel.css";

class MapOverview extends Component {
  render() {
    const { zoom } = this.props;
    return (
      <div className="panel">
        <h3>Map Overview</h3>
        <p>
          <strong>Map Type:</strong> {MAP_TYPE_LABEL}
        </p>
        <p>
          <strong>Zoom Level:</strong> {zoom ?? "-"}
        </p>
      </div>
    );
  }
}

export default MapOverview;
