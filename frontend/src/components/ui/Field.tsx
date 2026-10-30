import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

interface ShellProps {
  label: string
  error?: string
  hint?: string
  render: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; className: string }) => ReactNode
}

const CONTROL =
  'block w-full min-h-11 rounded-lg border bg-white px-3 py-2 text-base text-slate-900 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700'

function FieldShell({ label, error, hint, render }: ShellProps) {
  const id = useId()
  const messageId = `${id}-msg`
  const hasMessage = Boolean(error || hint)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {render({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': hasMessage ? messageId : undefined,
        className: `${CONTROL} ${error ? 'border-red-700' : 'border-slate-400'}`,
      })}
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type Common = { label: string; error?: string; hint?: string }

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, hint, ...rest }, ref) => (
    <FieldShell label={label} error={error} hint={hint} render={(p) => <input ref={ref} {...rest} {...p} />} />
  ),
)
TextField.displayName = 'TextField'

export const TextAreaField = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ label, error, hint, ...rest }, ref) => (
    <FieldShell label={label} error={error} hint={hint} render={(p) => <textarea ref={ref} rows={4} {...rest} {...p} />} />
  ),
)
TextAreaField.displayName = 'TextAreaField'

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  ({ label, error, hint, children, ...rest }, ref) => (
    <FieldShell
      label={label}
      error={error}
      hint={hint}
      render={(p) => (
        <select ref={ref} {...rest} {...p}>
          {children}
        </select>
      )}
    />
  ),
)
SelectField.displayName = 'SelectField'
