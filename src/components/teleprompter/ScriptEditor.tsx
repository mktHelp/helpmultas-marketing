"use client";

import { forwardRef, useCallback, useImperativeHandle } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Heading1, Heading2, Italic, List, ListOrdered,
  Quote, Redo2, RemoveFormatting, Send, Strikethrough, Underline as UnderlineIcon, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScriptEditorHandle {
  /** texto puro de todo o roteiro (parágrafos separados por linha em branco) */
  getText: () => string;
  getHTML: () => string;
  /** texto atualmente selecionado ("" se nada selecionado) */
  getSelectionText: () => string;
  /** substitui tudo */
  setText: (text: string) => void;
  /** substitui a seleção; sem seleção, acrescenta ao final */
  replaceSelectionOrAppend: (text: string) => void;
  focus: () => void;
}

const BLOCK_SEPARATOR = "\n\n";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto puro -> HTML de parágrafos (cada linha em branco separa um parágrafo). */
export function textToHtml(text: string) {
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function ToolButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // mousedown preventDefault mantém a seleção do texto ao clicar na barra
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors sm:h-8 sm:w-8",
        "hover:bg-gray-100 hover:text-blue-900 disabled:cursor-not-allowed disabled:opacity-30",
        active && "bg-yellow-100 text-blue-900"
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-gray-200" aria-hidden />;

export const ScriptEditor = forwardRef<
  ScriptEditorHandle,
  {
    /** conteúdo inicial; para trocar de roteiro, remonte o componente com outra `key` */
    initialHtml: string;
    onChange: (html: string, text: string) => void;
    /** "Enviar seleção/roteiro ao teleprompter" — recebe o texto selecionado ("" = tudo) */
    onSend: (selectionText: string) => void;
    className?: string;
  }
>(function ScriptEditor({ initialHtml, onChange, onSend, className }, ref) {
  const editor = useEditor({
    immediatelyRender: false, // evita divergência de hidratação no Next
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Escreva ou cole seu roteiro aqui… Selecione um trecho para enviá-lo ao teleprompter." }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: { attributes: { "aria-label": "Editor do roteiro", spellcheck: "true", lang: "pt-BR" } },
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML(), ed.getText({ blockSeparator: BLOCK_SEPARATOR })),
  });

  // Estado reativo da barra (negrito ativo, seleção, undo/redo…)
  const ui = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      const { from, to, empty } = ed.state.selection;
      return {
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        underline: ed.isActive("underline"),
        strike: ed.isActive("strike"),
        h1: ed.isActive("heading", { level: 1 }),
        h2: ed.isActive("heading", { level: 2 }),
        bullet: ed.isActive("bulletList"),
        ordered: ed.isActive("orderedList"),
        quote: ed.isActive("blockquote"),
        left: ed.isActive({ textAlign: "left" }),
        center: ed.isActive({ textAlign: "center" }),
        right: ed.isActive({ textAlign: "right" }),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        hasSelection: !empty && to > from,
        selectedWords: empty ? 0 : ed.state.doc.textBetween(from, to, " ").trim().split(/\s+/).filter(Boolean).length,
        words: ed.getText().trim().split(/\s+/).filter(Boolean).length,
      };
    },
  });

  const selectionText = useCallback(() => {
    if (!editor) return "";
    const { from, to, empty } = editor.state.selection;
    return empty ? "" : editor.state.doc.textBetween(from, to, "\n\n", "\n").trim();
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      getText: () => editor?.getText({ blockSeparator: BLOCK_SEPARATOR }) ?? "",
      getHTML: () => editor?.getHTML() ?? "",
      getSelectionText: selectionText,
      setText: (text) => {
        editor?.chain().focus().setContent(textToHtml(text), { emitUpdate: true }).run();
      },
      replaceSelectionOrAppend: (text) => {
        if (!editor) return;
        const html = textToHtml(text);
        const { empty } = editor.state.selection;
        if (empty) editor.chain().focus("end").insertContent(html).run();
        else editor.chain().focus().insertContent(html).run();
      },
      focus: () => editor?.commands.focus(),
    }),
    [editor, selectionText]
  );

  const run = (fn: () => void) => () => {
    if (editor) fn();
  };

  return (
    <div className={cn("doc-editor flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-100/70", className)}>
      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5">
        <div className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] sm:w-auto sm:flex-1 sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        <ToolButton label="Desfazer" onClick={run(() => editor!.chain().focus().undo().run())} disabled={!ui?.canUndo}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Refazer" onClick={run(() => editor!.chain().focus().redo().run())} disabled={!ui?.canRedo}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Título" active={ui?.h1} onClick={run(() => editor!.chain().focus().toggleHeading({ level: 1 }).run())}>
          <Heading1 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Subtítulo" active={ui?.h2} onClick={run(() => editor!.chain().focus().toggleHeading({ level: 2 }).run())}>
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Negrito" active={ui?.bold} onClick={run(() => editor!.chain().focus().toggleBold().run())}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Itálico" active={ui?.italic} onClick={run(() => editor!.chain().focus().toggleItalic().run())}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Sublinhado" active={ui?.underline} onClick={run(() => editor!.chain().focus().toggleUnderline().run())}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Tachado" active={ui?.strike} onClick={run(() => editor!.chain().focus().toggleStrike().run())}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Lista com marcadores" active={ui?.bullet} onClick={run(() => editor!.chain().focus().toggleBulletList().run())}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Lista numerada" active={ui?.ordered} onClick={run(() => editor!.chain().focus().toggleOrderedList().run())}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Citação / destaque" active={ui?.quote} onClick={run(() => editor!.chain().focus().toggleBlockquote().run())}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Alinhar à esquerda" active={ui?.left} onClick={run(() => editor!.chain().focus().setTextAlign("left").run())}>
          <AlignLeft className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Centralizar" active={ui?.center} onClick={run(() => editor!.chain().focus().setTextAlign("center").run())}>
          <AlignCenter className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Alinhar à direita" active={ui?.right} onClick={run(() => editor!.chain().focus().setTextAlign("right").run())}>
          <AlignRight className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Limpar formatação" onClick={run(() => editor!.chain().focus().clearNodes().unsetAllMarks().run())}>
          <RemoveFormatting className="h-4 w-4" />
        </ToolButton>
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSend(selectionText())}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold transition-all active:scale-95 sm:ml-auto sm:h-8 sm:w-auto",
            ui?.hasSelection
              ? "pg-pulse-soft bg-yellow-500 text-blue-900 hover:bg-yellow-400"
              : "bg-blue-900 text-white hover:bg-blue-800"
          )}
          title="Enviar para o teleprompter"
        >
          <Send className="h-3.5 w-3.5" />
          {ui?.hasSelection ? `Enviar seleção (${ui.selectedWords} palavras)` : "Enviar tudo ao teleprompter"}
        </button>
      </div>

      {/* "Folha" */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto max-w-3xl rounded-lg bg-white px-6 py-8 shadow-[var(--shadow-md)] sm:px-12 sm:py-12">
          {editor ? <EditorContent editor={editor} /> : <div className="ast-skeleton h-64 rounded-lg" />}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-500">
        <span>{ui?.words ?? 0} palavras</span>
        <span>{ui && ui.words > 0 ? `leitura ~ ${Math.max(1, Math.round((ui.words / 150) * 60))}s` : ""}</span>
      </div>
    </div>
  );
});
