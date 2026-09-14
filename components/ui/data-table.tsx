import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string
  responsive?: boolean
}

export const DataTable = React.forwardRef<HTMLTableElement, DataTableProps>(
  ({ className, wrapperClassName, responsive = true, children, ...props }, ref) => {
    return (
      <div className={cn(
        "w-full border border-border rounded-xl bg-card overflow-hidden",
        responsive && "overflow-x-auto",
        wrapperClassName
      )}>
        <table
          ref={ref}
          className={cn("w-full border-collapse text-left text-[13px] text-foreground", className)}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  }
)
DataTable.displayName = "DataTable"

export const DataTableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn(
          "bg-muted border-b border-border text-xs font-medium text-muted-foreground select-none sticky top-0 z-10",
          className
        )}
        {...props}
      >
        {children}
      </thead>
    )
  }
)
DataTableHeader.displayName = "DataTableHeader"

export interface DataTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  isActions?: boolean
  isCheckbox?: boolean
}

export const DataTableHead = React.forwardRef<HTMLTableCellElement, DataTableHeadProps>(
  ({ className, isActions, isCheckbox, children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          "px-4 py-3 font-semibold",
          isCheckbox && "w-10 px-3",
          isActions && "text-right",
          className
        )}
        {...props}
      >
        {children}
      </th>
    )
  }
)
DataTableHead.displayName = "DataTableHead"

export const DataTableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn("divide-y divide-border bg-card", className)}
      {...props}
    />
  )
)
DataTableBody.displayName = "DataTableBody"

export interface DataTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean
}

export const DataTableRow = React.forwardRef<HTMLTableRowElement, DataTableRowProps>(
  ({ className, hoverable = true, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "transition-colors",
        hoverable && "hover:bg-muted/60",
        className
      )}
      {...props}
    />
  )
)
DataTableRow.displayName = "DataTableRow"

export interface DataTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  isActions?: boolean
  isCheckbox?: boolean
}

export const DataTableCell = React.forwardRef<HTMLTableCellElement, DataTableCellProps>(
  ({ className, isActions, isCheckbox, children, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 align-middle whitespace-nowrap",
        isCheckbox && "w-10 px-3",
        isActions && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  )
)
DataTableCell.displayName = "DataTableCell"
