import React from "react";
import { Highlight, themes } from "prism-react-renderer";

function renderMarkdown(lines: string[]) {
  return (
    <div className="p-4 space-y-2 text-xs leading-relaxed max-w-2xl text-foreground">
      {lines.map((line, idx) => {
        if (line.startsWith("# ")) {
          return <h1 key={idx} className="text-base font-bold text-foreground border-b border-border/60 pb-1 mt-2">{line.slice(2)}</h1>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={idx} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={idx} className="text-xs font-semibold text-foreground mt-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <div key={idx} className="flex items-start gap-1.5 pl-2"><span className="text-muted-foreground">•</span><span>{line.slice(2)}</span></div>;
        }
        if (line.startsWith("> ")) {
          return <blockquote key={idx} className="border-l-2 border-border pl-2.5 text-muted-foreground italic text-[11px]">{line.slice(2)}</blockquote>;
        }
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />;
        }
        return <p key={idx} className="text-muted-foreground">{line}</p>;
      })}
    </div>
  );
}

export function DiffPreviewContent({
  code,
  language,
  isMarkdown,
  isDarkTheme,
}: {
  code: string;
  language: string;
  isMarkdown: boolean;
  isDarkTheme: boolean;
}) {
  if (isMarkdown) {
    return renderMarkdown(code.split("\n"));
  }

  return (
    <div className="p-2 h-full overflow-auto">
      <Highlight code={code || "// Empty file"} language={language} theme={isDarkTheme ? themes.vsDark : themes.vsLight}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`m-0 p-3 font-mono text-[11px] leading-[1.65] overflow-auto rounded-lg border border-border/80 ${className}`}
            style={{ ...style, backgroundColor: isDarkTheme ? "#0d1117" : "#f8fafc" }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} className="table-row">
                <span className="table-cell select-none pr-4 text-right font-mono text-muted-foreground text-[11px] tabular-nums font-medium">
                  {i + 1}
                </span>
                <span className="table-cell whitespace-pre select-text">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
