import { useProject } from "@/contexts/ProjectContext";
import { useMemo, useEffect, useRef } from "react";
import { Eye, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function PreviewPanel() {
  const { project } = useProject();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const htmlContent = useMemo(() => {
    if (!project) return null;

    const htmlFile = project.files.find(
      (f) => f.language === "html" || f.name.endsWith(".html")
    );
    const cssFile = project.files.find(
      (f) => f.language === "css" || f.name.endsWith(".css")
    );
    const jsFile = project.files.find(
      (f) => f.language === "javascript" || f.language === "js" || f.name.endsWith(".js")
    );

    if (!htmlFile) return null;

    let html = htmlFile.content;
    
    // Inject CSS
    if (cssFile) {
      if (html.includes("</head>")) {
        html = html.replace("</head>", `<style>${cssFile.content}</style></head>`);
      } else {
        html = `<style>${cssFile.content}</style>` + html;
      }
    }
    
    // Inject JS
    if (jsFile) {
      if (html.includes("</body>")) {
        html = html.replace("</body>", `<script>${jsFile.content}<\/script></body>`);
      } else {
        html += `<script>${jsFile.content}<\/script>`;
      }
    }
    
    return html;
  }, [project]);

  const refreshPreview = () => {
    if (iframeRef.current && htmlContent) {
      iframeRef.current.srcdoc = htmlContent;
      toast.success("Preview refreshed");
    }
  };

  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <Eye className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Preview will appear here once Nero generates HTML code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">Live Preview</span>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshPreview}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const blob = new Blob([htmlContent], { type: "text/html" });
              window.open(URL.createObjectURL(blob), "_blank");
            }}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
          title="Preview"
        />
      </div>
    </div>
  );
}
