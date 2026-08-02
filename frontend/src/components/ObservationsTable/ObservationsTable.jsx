import { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import ExcelJS from "exceljs";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { TABLE_COLUMNS, SURVEY_TYPES, fetchSurveyLocations } from "../../config/mapConfig";
import "../../css/ObservationsTable.css";

ModuleRegistry.registerModules([AllCommunityModule]);

const BASE_PAGE_SIZES = [25, 50, 75, 100];

// Same formatting rules as the grid's own valueFormatter, kept in sync so the exported file matches
// what's shown on screen (blank instead of "0.000000" for unset coordinates, fixed decimal places).
const formatCellValue = (field, row) => {
  const value = row[field];
  if ((field === "lat" || field === "lng") && row.lat === 0 && row.lng === 0) return "";
  if (typeof value === "number") return value.toFixed(field === "lat" || field === "lng" ? 6 : 0);
  return value ?? "";
};

// Widest cell (including the header) in a column, so every value fits on a single line with no wrapping.
const computeColumnWidth = (field, label, rows) => {
  let maxLength = label.length;
  for (const row of rows) {
    const length = String(formatCellValue(field, row)).length;
    if (length > maxLength) maxLength = length;
  }
  return maxLength + 2;
};

const formatReportDate = (date) =>
  date
    .toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
    .replace(",", "");

const downloadWorkbook = async (workbook, fileName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function ObservationsTable({ locations, onSelectLocation, surveyType }) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedTables, setSelectedTables] = useState(() => new Set());

  const columnDefs = useMemo(
    () =>
      TABLE_COLUMNS.map(({ field, label }) => ({
        field,
        headerName: label,
        valueFormatter: ({ data, value }) => {
          // lat/lng default to 0 when a sighting has no real coordinates (e.g. most Rope Bridge
          // rows) - show blank instead of a misleading "0.000000".
          if ((field === "lat" || field === "lng") && data && data.lat === 0 && data.lng === 0) return "";
          if (typeof value === "number") return value.toFixed(field === "lat" || field === "lng" ? 6 : 0);
          return value || "";
        },
      })),
    []
  );

  const defaultColDef = useMemo(
    () => ({ sortable: true, resizable: false, filter: false, minWidth: 120, flex: 1 }),
    []
  );

  // "All records" is always offered as a page-size option so the default view can show everything.
  const pageSizeOptions = useMemo(() => {
    const total = locations.length || BASE_PAGE_SIZES[0];
    return Array.from(new Set([...BASE_PAGE_SIZES, total])).sort((a, b) => a - b);
  }, [locations.length]);

  const handleRowClicked = (event) => {
    if (event.data) onSelectLocation(event.data);
  };

  const toggleTable = (table) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  // Exports the whole (unfiltered) dataset for each selected survey type, ignoring any filters
  // currently applied on screen, since "export the table" means the full sheet, not the current view.
  // All selected tables go into one workbook, each as its own tab.
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();

      for (const table of SURVEY_TYPES) {
        if (!selectedTables.has(table)) continue;
        const tableLocations = table === surveyType ? locations : await fetchSurveyLocations(table);
        const sheet = workbook.addWorksheet(table, { views: [{ state: "frozen", ySplit: 1 }] });

        sheet.columns = TABLE_COLUMNS.map(({ field, label }) => ({
          header: label,
          key: field,
          width: computeColumnWidth(field, label, tableLocations),
        }));

        tableLocations.forEach((row) => {
          const rowValues = {};
          TABLE_COLUMNS.forEach(({ field }) => {
            rowValues[field] = formatCellValue(field, row);
          });
          sheet.addRow(rowValues);
        });

        // Bold, frozen, non-wrapping header so every value stays readable on a single line.
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { wrapText: false };
        sheet.eachRow((row) => {
          row.alignment = { ...row.alignment, wrapText: false };
        });
      }

      await downloadWorkbook(workbook, `Observation Report_${formatReportDate(new Date())}.xlsx`);
      setIsExportOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="observations-table panel">
      <div className="observations-table-header">
        <h3>All Observations ({locations.length})</h3>
        <button type="button" className="observations-table-export-btn" onClick={() => setIsExportOpen(true)}>
          Export
        </button>
      </div>
      <div
        className={`ag-theme-alpine observations-table-grid${
          surveyType === "Rope Bridge" ? " observations-table-grid-no-header-border" : ""
        }`}
      >
        <AgGridReact
          theme="legacy"
          rowData={locations}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination
          paginationPageSize={locations.length || BASE_PAGE_SIZES[0]}
          paginationPageSizeSelector={pageSizeOptions}
          onRowClicked={handleRowClicked}
          rowSelection={{ mode: "singleRow", checkboxes: false }}
          suppressCellFocus
          animateRows
        />
      </div>

      {isExportOpen && (
        <div
          className="export-dialog-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => !isExporting && setIsExportOpen(false)}
        >
          <div className="export-dialog" onClick={(event) => event.stopPropagation()}>
            <h4>Export Tables</h4>
            <div className="export-dialog-tables">
              {SURVEY_TYPES.map((table) => (
                <button
                  type="button"
                  key={table}
                  className={`export-dialog-table-btn${selectedTables.has(table) ? " export-dialog-table-btn-active" : ""}`}
                  onClick={() => toggleTable(table)}
                >
                  {table}
                </button>
              ))}
            </div>
            <div className="export-dialog-actions">
              <button
                type="button"
                className="export-dialog-cancel"
                onClick={() => setIsExportOpen(false)}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="export-dialog-confirm"
                onClick={handleExport}
                disabled={selectedTables.size === 0 || isExporting}
              >
                {isExporting ? "Exporting..." : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ObservationsTable;

