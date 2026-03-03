"use client";
import { useState, useMemo, ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  Row,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "./Spinner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DataTableProps<TData = any> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  loading?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (row: TData) => void;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  globalFilter?: string;
  className?: string;
  toolbar?: ReactNode;
  getRowId?: (row: TData) => string;
  stickyHeader?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataTable<TData = any>({
  data,
  columns,
  loading = false,
  pageSize = 25,
  pageSizeOptions = [25, 50, 100],
  emptyMessage = "No hay datos",
  emptyIcon,
  onRowClick,
  enableRowSelection = false,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  columnVisibility: controlledVisibility,
  onColumnVisibilityChange,
  globalFilter: externalFilter,
  className = "",
  toolbar,
  getRowId,
  stickyHeader = false,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState("");

  const columnVisibility = controlledVisibility ?? internalVisibility;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const activeGlobalFilter = externalFilter ?? globalFilter;

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: activeGlobalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      const newVal = typeof updater === "function" ? updater(columnVisibility) : updater;
      if (onColumnVisibilityChange) onColumnVisibilityChange(newVal);
      else setInternalVisibility(newVal);
    },
    onRowSelectionChange: (updater) => {
      const newVal = typeof updater === "function" ? updater(rowSelection) : updater;
      if (onRowSelectionChange) onRowSelectionChange(newVal);
      else setInternalRowSelection(newVal);
    },
    onGlobalFilterChange: externalFilter !== undefined ? undefined : setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection,
    getRowId,
    initialState: {
      pagination: { pageSize },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const totalPages = table.getPageCount();

  return (
    <div className={`bg-surface rounded-xl border border-slate-800/60 overflow-hidden ${className}`}>
      {toolbar && (
        <div className="px-4 py-3 border-b border-slate-800/40 flex items-center gap-3 flex-wrap">
          {toolbar}
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className={`bg-slate-800/40 border-b border-slate-800/40 ${stickyHeader ? "sticky top-0 z-10" : ""}`}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${
                        canSort ? "cursor-pointer select-none hover:text-slate-300 transition-colors" : ""
                      }`}
                      style={{
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                        minWidth: header.column.columnDef.minSize,
                      }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="ml-1">
                            {sorted === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : sorted === "desc" ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-slate-800/40">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  {emptyIcon && (
                    <div className="flex justify-center mb-3 text-slate-700">{emptyIcon}</div>
                  )}
                  <p className="text-slate-500 text-sm">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-surface-hover transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${row.getIsSelected() ? "bg-amber-500/5" : ""}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalRows > 0 && (
        <div className="px-4 py-3 border-t border-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {pageIndex * currentPageSize + 1}-{Math.min((pageIndex + 1) * currentPageSize, totalRows)} de {totalRows}
            </span>
            <select
              value={currentPageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="px-2 py-1 bg-slate-800/50 border border-slate-700 text-slate-300 rounded-lg text-xs outline-none"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} filas
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <span className="text-sm text-slate-500 px-3">
              {pageIndex + 1} de {totalPages}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-700 text-slate-300 rounded-lg disabled:opacity-30 hover:bg-surface-hover transition-colors font-medium"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to create selection column
function createSelectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: "select",
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="w-4 h-4 rounded border-slate-700 bg-slate-800/50 text-amber-500 focus:ring-amber-500/40"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(e) => e.stopPropagation()}
        className="w-4 h-4 rounded border-slate-700 bg-slate-800/50 text-amber-500 focus:ring-amber-500/40"
      />
    ),
    size: 40,
    enableSorting: false,
  };
}

export { DataTable, createSelectionColumn };
export type { DataTableProps };
