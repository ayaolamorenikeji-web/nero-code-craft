import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  createdAt: Date;
}

interface ProjectContextType {
  project: Project | null;
  setProject: (p: Project | null) => void;
  activeFile: ProjectFile | null;
  setActiveFile: (f: ProjectFile | null) => void;
  updateFile: (id: string, content: string) => void;
  addFile: (file: ProjectFile) => void;
  consoleOutput: string[];
  addConsoleLog: (msg: string) => void;
  clearConsole: () => void;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const updateFile = useCallback((id: string, content: string) => {
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        files: prev.files.map((f) => (f.id === id ? { ...f, content } : f)),
      };
    });
    setActiveFile((prev) => (prev?.id === id ? { ...prev, content } : prev));
  }, []);

  const addFile = useCallback((file: ProjectFile) => {
    setProject((prev) => {
      if (!prev) return prev;
      const exists = prev.files.find((f) => f.path === file.path);
      if (exists) {
        return {
          ...prev,
          files: prev.files.map((f) => (f.path === file.path ? file : f)),
        };
      }
      return { ...prev, files: [...prev.files, file] };
    });
  }, []);

  const addConsoleLog = useCallback((msg: string) => {
    setConsoleOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearConsole = useCallback(() => setConsoleOutput([]), []);

  return (
    <ProjectContext.Provider
      value={{ project, setProject, activeFile, setActiveFile, updateFile, addFile, consoleOutput, addConsoleLog, clearConsole }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
