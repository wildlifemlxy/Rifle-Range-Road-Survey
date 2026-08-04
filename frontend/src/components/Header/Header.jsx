import { Component } from "react";
import "../../css/Header.css";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

class Header extends Component {
  // `now` drives a live-updating clock in the top bar.
  state = {
    now: new Date(),
  };

  componentDidMount() {
    this.clockInterval = setInterval(() => this.setState({ now: new Date() }), 1000);
  }

  componentWillUnmount() {
    clearInterval(this.clockInterval);
  }

  render() {
    const { onChangeTab } = this.props;
    const { now } = this.state;

    return (
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-header-brand">
            <span className="app-header-title">Rifle Range Road Survey</span>
            <span className="app-header-datetime">{DATE_TIME_FORMATTER.format(now)}</span>
            <span className="app-header-tagline">Comprehensive Wildlife Crossing Survey Analytics</span>
          </div>
          {/*
          <button type="button" className="home-button" onClick={() => onChangeTab("overview")}>
            <span className="home-button-icon">🏠</span>
            Home
          </button>
          */}
        </div>
      </header>
    );
  }
}

export default Header;


