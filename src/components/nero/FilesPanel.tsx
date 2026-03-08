import { useProject } from "@/contexts/ProjectContext";
import { FileText, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "html": return html();
    case "css": return css();
    case "javascript": case "js": return javascript();
    case "typescript": case "ts": return javascript({ typescript: true });
    case "tsx": return javascript({ jsx: true, typescript: true });
    case "jsx": return javascript({ jsx: true });
    case "json": return json();
    case "markdown": case "md": return markdown();
    case "python": case "py": return python();
    default: return javascript();
  }
}

function CodeMirrorEditor({ content, language, onChange }: { content: string; language: string; onChange: (val: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        bracketMatching(),
        foldGutter(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        getLanguageExtension(language),
        oneDark,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "12px" },
          ".cm-scroller": { overflow: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          ".cm-content": { padding: "8px 0" },
          ".cm-gutters": { border: "none" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => { view.destroy(); viewRef.current = null; };
    // Only recreate on language change, not content
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync external content changes (e.g. when switching files)
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden" />;
}

export function FilesPanel() {
  const { project, activeFile, setActiveFile, updateFile } = useProject();

  const handleContentChange = useCallback(
    (val: string) => {
      if (activeFile) {
        updateFile(activeFile.id, val);
      }
    },
    [activeFile, updateFile]
  );

  if (!project || project.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <FolderOpen className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No files yet. Start chatting with Nero to generate code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* File list */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="p-3 space-y-0.5 max-h-48 overflow-y-auto nero-scrollbar">
          {project.files.map((file) => (
            <button
              key={file.id}
              onClick={() => setActiveFile(file)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                activeFile?.id === file.id
                  ? "bg-nero-tab-active text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover"
              }`}
            >
              <FileText className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate font-mono text-xs">{file.path}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CodeMirror editor */}
      <div className="flex-1 overflow-hidden">
        {activeFile ? (
          <motion.div
            key={activeFile.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full"
          >
            <CodeMirrorEditor
              content={activeFile.content}
              language={activeFile.language}
              onChange={handleContentChange}
            />
          </motion.div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
