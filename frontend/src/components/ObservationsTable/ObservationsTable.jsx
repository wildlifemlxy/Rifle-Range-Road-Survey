import { Component } from "react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import ExcelJS from "exceljs";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { TABLE_COLUMNS, SURVEY_TYPES, fetchSurveyLocations, surveyDateSortValue } from "../../config/mapConfig";
import "../../css/Header.css";
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

const columnDefs = [
  {
    headerName: "S/N",
    // Row's position in the full (sorted/filtered) dataset, not just the current page, so
    // numbering stays continuous when paging through the table.
    valueGetter: (params) => (params.node ? params.node.rowIndex + 1 : ""),
    width: 70,
    sortable: false,
    filter: false,
    pinned: "left",
  },
  ...TABLE_COLUMNS.map(({ field, label }, index) => ({
    field,
    headerName: label,
    valueFormatter: ({ data }) => (data ? formatCellValue(field, data) : ""),
    // S/N above is pinned column 1 - pin the next two (Common Name, Scientific Name) so the
    // first 3 columns overall stay in view while scrolling horizontally through the rest.
    ...(index < 2 ? { pinned: "left" } : {}),
    // Survey Date isn't in one consistent format across sheets (YYYY-MM-DD vs DD/MM/YYYY) - the default
    // string comparator would sort External's dates out of chronological order, so use a date-aware one.
    ...(field === "surveyDate" ? { comparator: (a, b) => surveyDateSortValue(a) - surveyDateSortValue(b) } : {}),
  })),
];

const defaultColDef = { sortable: true, resizable: false, filter: false };

class ObservationsTable extends Component {
  state = {
    isExportOpen: false,
    isExporting: false,
    selectedTables: new Set(),
  };

  getPageSizeOptions() {
    const total = this.props.locations.length || BASE_PAGE_SIZES[0];
    return Array.from(new Set([...BASE_PAGE_SIZES, total])).sort((a, b) => a - b);
  }

  handleRowClicked = (event) => {
    if (event.data) this.props.onSelectLocation?.(event.data);
  };

  toggleTable = (table) => {
    this.setState((prev) => {
      const next = new Set(prev.selectedTables);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return { selectedTables: next };
    });
  };

  // Exports the whole (unfiltered) dataset for each selected survey type, ignoring any filters
  // currently applied on screen, since "export the table" means the full sheet, not the current view.
  // All selected tables go into one workbook, each as its own tab.
  handleExport = async () => {
    const { locations, surveyType } = this.props;
    const { selectedTables } = this.state;
    this.setState({ isExporting: true });
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
      this.setState({ isExportOpen: false });
    } catch (err) {
      console.error(err);
    } finally {
      this.setState({ isExporting: false });
    }
  };

  render() {
    const { locations, surveyType } = this.props;
    const { isExportOpen, isExporting, selectedTables } = this.state;

    return (
      <>
        <div className="observations-table-toolbar">
          <h3>All Observations ({locations.length})</h3>
          <button
            type="button"
            className="header-tab observations-table-export-btn"
            onClick={() => this.setState({ isExportOpen: true })}
          >
            <span className="header-tab-icon">⬇️</span>
            Export
          </button>
        </div>
        <div className="observations-table panel">
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
              autoSizeStrategy={{ type: "fitCellContents" }}
              alwaysShowHorizontalScroll
              alwaysShowVerticalScroll
              pagination
              paginationPageSize={locations.length}
              paginationPageSizeSelector={this.getPageSizeOptions()}
              onRowClicked={this.handleRowClicked}
              rowSelection={{ mode: "singleRow", checkboxes: false }}
              suppressCellFocus
              animateRows
            />
          </div>
        </div>

        {isExportOpen && (
          <div
            className="export-dialog-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => !isExporting && this.setState({ isExportOpen: false })}
          >
            <div className="export-dialog" onClick={(event) => event.stopPropagation()}>
              <h4>Export Tables</h4>
              <div className="export-dialog-tables">
                {SURVEY_TYPES.map((table) => (
                  <button
                    type="button"
                    key={table}
                    className={`export-dialog-table-btn${selectedTables.has(table) ? " export-dialog-table-btn-active" : ""}`}
                    onClick={() => this.toggleTable(table)}
                  >
                    {table}
                  </button>
                ))}
              </div>
              <div className="export-dialog-actions">
                <button
                  type="button"
                  className="export-dialog-cancel"
                  onClick={() => this.setState({ isExportOpen: false })}
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="export-dialog-confirm"
                  onClick={this.handleExport}
                  disabled={selectedTables.size === 0 || isExporting}
                >
                  {isExporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default ObservationsTable;
