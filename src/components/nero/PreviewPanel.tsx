import { useProject } from "@/contexts/ProjectContext";
import { useMemo } from "react";
import { Eye, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";

export function PreviewPanel() {
  const { project } = useProject();

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
    if (cssFile) {
      html = html.replace("</head>", `<style>${cssFile.content}</style></head>`);
    }
    if (jsFile) {
      html = html.replace("</body>", `<script>${jsFile.content}<\/script></body>`);
    }
    return html;
  }, [project]);

  const previewUrl = useMemo(() => {
    if (!htmlContent) return null;
    const blob = new Blob([htmlContent], { type: "text/html" });
    return URL.createObjectURL(blob);
  }, [htmlContent]);

  const copyShareLink = () => {
    // In a real deployment, this would be a hosted URL
    if (previewUrl) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied! Share with others to show your project.");
    }
  };

  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <Eye className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Preview will appear here once Nero generates HTML.
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
            onClick={copyShareLink}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
            title="Copy share link"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <a
            href={previewUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <div className="flex-1">
        <iframe
          srcDoc={htmlContent}
          className="w-full h-full border-0 bg-foreground"
          sandbox="allow-scripts allow-same-origin"
          title="Preview"
        />
      </div>
    </div>
  );
}
