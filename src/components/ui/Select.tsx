"use client";

import { Children, Fragment, isValidElement, useMemo, useState } from "react";
import { Listbox, type ListboxOption } from "./Listbox";

// Lista suspensa padrão do Hub. Mantém a API do <select> nativo (filhos
// <option>, value/defaultValue, onChange com e.target.value), mas desenha o
// painel próprio (ver Listbox).

function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

export function parseOptions(children: React.ReactNode): ListboxOption[] {
  const out: ListboxOption[] = [];
  const walk = (nodes: React.ReactNode) =>
    Children.forEach(nodes, (child) => {
      if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child)) return;
      if (child.type === "option") {
        const label = nodeText(child.props.children);
        out.push({ value: child.props.value !== undefined ? String(child.props.value) : label, label, disabled: child.props.disabled });
      } else if (child.type === "optgroup" || child.type === Fragment) {
        walk(child.props.children);
      }
    });
  walk(children);
  return out;
}

export function Select({
  className, children, value, defaultValue, onChange, disabled, required, name, id, style, ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => parseOptions(children), [children]);
  const [inner, setInner] = useState(defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : inner;

  return (
    <Listbox
      options={options}
      value={[current]}
      onChange={([next]) => {
        if (value === undefined) setInner(next);
        // Evento sintético mínimo: os usos só leem e.target.value.
        const target = { value: next, name: name ?? "" };
        onChange?.({ target, currentTarget: target } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }}
      disabled={disabled}
      required={required}
      name={name}
      id={id}
      ariaLabel={rest["aria-label"]}
      className={className}
      style={style}
    />
  );
}
