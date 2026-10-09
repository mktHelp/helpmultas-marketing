"use client";

import { Listbox } from "./Listbox";

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string;
}

export function MultiSelect({
  placeholder,
  options,
  selected,
  onChange,
  className,
}: {
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  className?: string;
}) {
  return (
    <Listbox
      multiple
      options={options}
      value={selected}
      onChange={onChange}
      placeholder={placeholder}
      pluralLabel="selecionados"
      wrapperClassName={className}
      className="min-w-[160px]"
    />
  );
}
