import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Project {
  id: string;
  name: string;
  files: ProjectFile[];
  createdAt: Date;
  chatMessages: ChatMessage[];
}

interface ProjectContextType {
  projects: Project[];
  project: Project | null;
  setProject: (p: Project | null) => void;
  createNewProject: (name?: string) => Project;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  activeFile: ProjectFile | null;
  setActiveFile: (f: ProjectFile | null) => void;
  updateFile: (id: string, content: string) => void;
  addFile: (file: ProjectFile) => void;
  addChatMessage: (msg: ChatMessage) => void;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const project = projects.find((p) => p.id === activeProjectId) || null;

  const setProject = useCallback((p: Project | null) => {
    if (!p) {
      setActiveProjectId(null);
      return;
    }
    setProjects((prev) => {
      const exists = prev.find((x) => x.id === p.id);
      if (exists) return prev.map((x) => (x.id === p.id ? p : x));
      return [...prev, p];
    });
    setActiveProjectId(p.id);
  }, []);

  const createNewProject = useCallback((name?: string) => {
    const p: Project = {
      id: crypto.randomUUID(),
      name: name || `Project ${Date.now().toString(36)}`,
      files: [],
      createdAt: new Date(),
      chatMessages: [],
    };
    setProjects((prev) => [...prev, p]);
    setActiveProjectId(p.id);
    setActiveFile(null);
    setConsoleOutput([]);
    return p;
  }, []);

  const switchProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setActiveFile(null);
    setConsoleOutput([]);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProjectId((curr) => (curr === id ? null : curr));
  }, []);

  const updateFile = useCallback((id: string, content: string) => {
    setProjects((prev) =>
      prev.map((p) => ({
        ...p,
        files: p.files.map((f) => (f.id === id ? { ...f, content } : f)),
      }))
    );
    setActiveFile((prev) => (prev?.id === id ? { ...prev, content } : prev));
  }, []);

  const addFile = useCallback((file: ProjectFile) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== prev.find((x) => x.id === (document as any).__neroActiveProjectId)?.id) {
          // fallback: update the active project
        }
        const exists = p.files.find((f) => f.path === file.path);
        if (exists) {
          return { ...p, files: p.files.map((f) => (f.path === file.path ? file : f)) };
        }
        return { ...p, files: [...p.files, file] };
      })
    );
  }, []);

  // Better addFile that targets active project
  const addFileToActive = useCallback((file: ProjectFile) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== activeProjectId) return p;
        const exists = p.files.find((f) => f.path === file.path);
        if (exists) {
          return { ...p, files: p.files.map((f) => (f.path === file.path ? file : f)) };
        }
        return { ...p, files: [...p.files, file] };
      })
    );
  }, [activeProjectId]);

  const addChatMessage = useCallback((msg: ChatMessage) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== activeProjectId) return p;
        return { ...p, chatMessages: [...p.chatMessages, msg] };
      })
    );
  }, [activeProjectId]);

  const addConsoleLog = useCallback((msg: string) => {
    setConsoleOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const clearConsole = useCallback(() => setConsoleOutput([]), []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        project,
        setProject,
        createNewProject,
        switchProject,
        deleteProject,
        activeFile,
        setActiveFile,
        updateFile,
        addFile: addFileToActive,
        addChatMessage,
        consoleOutput,
        addConsoleLog,
        clearConsole,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
