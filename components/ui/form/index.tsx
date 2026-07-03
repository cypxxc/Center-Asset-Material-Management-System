import * as React from "react"
import { cn } from "@/lib/utils"

export type FormFieldProps = React.HTMLAttributes<HTMLDivElement>

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1.5", className)} {...props} />
  )
)
FormField.displayName = "FormField"

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[11px] font-bold text-slate-700 select-none flex items-center gap-0.5", className)}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 font-bold">*</span>}
    </label>
  )
)
FormLabel.displayName = "FormLabel"

export type FormHintProps = React.HTMLAttributes<HTMLParagraphElement>

export const FormHint = React.forwardRef<HTMLParagraphElement, FormHintProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[10px] text-slate-400 leading-normal", className)} {...props} />
  )
)
FormHint.displayName = "FormHint"

export type FormErrorProps = React.HTMLAttributes<HTMLParagraphElement>

export const FormError = React.forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-[10px] font-semibold text-red-500 leading-normal animate-in fade-in-50 duration-200", className)} {...props} />
  )
)
FormError.displayName = "FormError"

export interface FormSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
}

export const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ className, title, description, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-4 border-b border-slate-100 pb-6 last:border-0 last:pb-0", className)} {...props}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h4 className="text-xs font-bold text-slate-800">{title}</h4>}
          {description && <p className="text-[10px] text-slate-400">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  )
)
FormSection.displayName = "FormSection"

export type FormActionsProps = React.HTMLAttributes<HTMLDivElement>

export const FormActions = React.forwardRef<HTMLDivElement, FormActionsProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-6", className)} {...props} />
  )
)
FormActions.displayName = "FormActions"

export interface FormGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4
}

export const FormGrid = React.forwardRef<HTMLDivElement, FormGridProps>(
  ({ className, cols = 2, ...props }, ref) => {
    const colClass = {
      1: "grid-cols-1",
      2: "grid-cols-1 md:grid-cols-2 gap-4",
      3: "grid-cols-1 md:grid-cols-3 gap-4",
      4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4",
    }[cols]
    return (
      <div ref={ref} className={cn("grid", colClass, className)} {...props} />
    )
  }
)
FormGrid.displayName = "FormGrid"

export const FormDivider = () => <hr className="border-t border-slate-100 my-4" />

export type FormInputProps = React.InputHTMLAttributes<HTMLInputElement>
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-rose-300 aria-invalid:ring-rose-200",
        className
      )}
      {...props}
    />
  )
)
FormInput.displayName = "FormInput"

export type FormTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>
export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-rose-300 aria-invalid:ring-rose-200",
        className
      )}
      {...props}
    />
  )
)
FormTextarea.displayName = "FormTextarea"

export type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>
export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer aria-invalid:border-rose-300 aria-invalid:ring-rose-200",
        className
      )}
      {...props}
    />
  )
)
FormSelect.displayName = "FormSelect"
