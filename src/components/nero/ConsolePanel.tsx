import { useProject } from "@/contexts/ProjectContext";
import { Terminal, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ConsolePanel() {
  const { consoleOutput, clearConsole } = useProject();

  return (
    <div className="flex flex-col h-full bg-nero-code-bg">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">Console</span>
        </div>
        <button
          onClick={clearConsole}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto nero-scrollbar p-3 space-y-1">
        {consoleOutput.length === 0 ? (
          <p className="text-xs text-muted-foreground font-mono">
            Console output will appear here...
          </p>
        ) : (
          <AnimatePresence>
            {consoleOutput.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-mono text-secondary-foreground leading-relaxed"
              >
                {line}
              </motion.p>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
