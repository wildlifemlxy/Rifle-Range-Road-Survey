import { useEffect, useState } from "react";
import { fetchSurveySummary } from "../../config/mapConfig";
import { useSurveyFiltersContext } from "../../context/SurveyFiltersContext";
import "../../css/panel.css";

function DataOverview() {
  const { surveyType } = useSurveyFiltersContext();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);

    fetchSurveySummary(surveyType)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load summary");
      });

    return () => {
      cancelled = true;
    };
  }, [surveyType]);

  return (
    <div className="panel">
      <h3>Data Overview</h3>
      {error && <p className="panel-error">{error}</p>}
      {!error && !summary && <p>Loading...</p>}
      {summary && (
        <>
          {summary.items.map(({ label, value }) => (
            <p key={label}>
              <strong>{label}:</strong> {value}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

export default DataOverview;
