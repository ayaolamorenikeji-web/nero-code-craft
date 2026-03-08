import { useProject, ProjectFile } from "@/contexts/ProjectContext";
import { FileText, FolderOpen, ChevronRight, ChevronDown, Folder } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useRef, useEffect, useState } from "react";
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

// --- File Tree Logic ---
interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  file?: ProjectFile;
}

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const existingIdx = current.findIndex((n) => n.name === part && n.isFolder === !isLast);

      if (isLast) {
        // It's a file
        if (existingIdx === -1) {
          current.push({ name: part, path: file.path, isFolder: false, children: [], file });
        }
      } else {
        // It's a folder
        let folder: TreeNode;
        const folderIdx = current.findIndex((n) => n.name === part && n.isFolder);
        if (folderIdx === -1) {
          folder = { name: part, path: parts.slice(0, i + 1).join("/"), isFolder: true, children: [] };
          current.push(folder);
        } else {
          folder = current[folderIdx];
        }
        current = folder.children;
      }
    }
  }

  // Sort: folders first, then files, both alphabetical
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => { if (n.isFolder) sortNodes(n.children); });
  };
  sortNodes(root);
  return root;
}

function FileTreeNode({
  node,
  depth,
  activeFileId,
  expandedFolders,
  toggleFolder,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  activeFileId: string | null;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onSelectFile: (file: ProjectFile) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);

  if (node.isFolder) {
    return (
      <div>
        <button
          onClick={() => toggleFolder(node.path)}
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
          <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono">{node.name}</span>
        </button>
        {isExpanded && node.children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            activeFileId={activeFileId}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    );
  }

  const isActive = node.file?.id === activeFileId;
  return (
    <button
      onClick={() => node.file && onSelectFile(node.file)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors text-left ${
        isActive ? "bg-nero-tab-active text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover"
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate font-mono">{node.name}</span>
    </button>
  );
}

// --- CodeMirror Editor ---
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

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

// --- Main Panel ---
export function FilesPanel() {
  const { project, activeFile, setActiveFile, updateFile } = useProject();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand all folders on first load / when files change
  useEffect(() => {
    if (project?.files.length) {
      const allFolders = new Set<string>();
      project.files.forEach((f) => {
        const parts = f.path.split("/");
        for (let i = 1; i < parts.length; i++) {
          allFolders.add(parts.slice(0, i).join("/"));
        }
      });
      setExpandedFolders(allFolders);
    }
  }, [project?.files.length]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

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

  const tree = buildTree(project.files);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* File tree */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="p-2 space-y-0.5 max-h-52 overflow-y-auto nero-scrollbar">
          {tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFileId={activeFile?.id || null}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onSelectFile={setActiveFile}
            />
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
