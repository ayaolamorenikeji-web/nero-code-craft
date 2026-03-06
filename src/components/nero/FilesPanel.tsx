import { useProject } from "@/contexts/ProjectContext";
import { FileText, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";

export function FilesPanel() {
  const { project, activeFile, setActiveFile } = useProject();

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

      {/* Code view */}
      <div className="flex-1 overflow-auto nero-scrollbar">
        {activeFile ? (
          <motion.pre
            key={activeFile.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 text-xs font-mono text-secondary-foreground leading-relaxed whitespace-pre-wrap bg-nero-code-bg min-h-full"
          >
            {activeFile.content}
          </motion.pre>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a file to view
          </div>
        )}
      </div>
    </div>
  );
}
