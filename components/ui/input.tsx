"use client"

import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
      onInvalid={event => {
        const input = event.currentTarget;
        const validity = input.validity;
        input.setCustomValidity(validity.valueMissing ? "Compila questo campo per continuare." : validity.typeMismatch && type === "email" ? "Inserisci un indirizzo email valido, per esempio nome@azienda.it." : validity.rangeUnderflow ? `Inserisci un numero uguale o maggiore di ${input.min}.` : validity.rangeOverflow ? `Inserisci un numero uguale o minore di ${input.max}.` : validity.stepMismatch && input.step === "1" ? "Inserisci un numero intero, senza virgole." : validity.tooShort ? `Inserisci almeno ${input.minLength} caratteri.` : "Controlla questo campo e inserisci un valore valido.");
        props.onInvalid?.(event);
      }}
      onInput={event => { event.currentTarget.setCustomValidity(""); props.onInput?.(event); }}
    />
  )
}

export { Input }
