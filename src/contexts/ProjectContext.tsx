import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";

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
  renameProject: (id: string, name: string) => void;
  activeFile: ProjectFile | null;
  setActiveFile: (f: ProjectFile | null) => void;
  updateFile: (id: string, content: string) => void;
  addFile: (file: ProjectFile) => void;
  deleteFile: (path: string) => void;
  renameFile: (oldPath: string, newPath: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  consoleOutput: string[];
  addConsoleLog: (msg: string) => void;
  clearConsole: () => void;
}

const STORAGE_KEY = "nero-projects";
const ACTIVE_KEY = "nero-active-project";

function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((p: any) => ({ ...p, createdAt: new Date(p.createdAt) }));
  } catch { return []; }
}

function saveProjects(projects: Project[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const useProject = () => {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY) || null
  );
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(null);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  // Persist projects
  useEffect(() => { saveProjects(projects); }, [projects]);
  useEffect(() => {
    if (activeProjectId) localStorage.setItem(ACTIVE_KEY, activeProjectId);
    else localStorage.removeItem(ACTIVE_KEY);
  }, [activeProjectId]);

  const project = projects.find((p) => p.id === activeProjectId) || null;

  const setProject = useCallback((p: Project | null) => {
    if (!p) { setActiveProjectId(null); return; }
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
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProjectId((curr) => (curr === id ? null : curr));
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, name } : p));
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
        projects, project, setProject, createNewProject, switchProject,
        deleteProject, renameProject, activeFile, setActiveFile, updateFile,
        addFile: addFileToActive, addChatMessage, consoleOutput, addConsoleLog, clearConsole,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
