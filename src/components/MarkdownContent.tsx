"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import type { PluggableList } from "unified";
import type { Element } from "hast";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { CodeBlock } from "@/components/CodeBlock";
import { SourceCite } from "@/components/SourceCite";
import { hastToText } from "@/lib/hast";
import { parseCiteIndices } from "@/lib/search/sources";
import type { SearchSource } from "@/types";

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** ID of the LivePreview panel — enables "jump to preview" on web code blocks */
  previewTargetId?: string;
  /** Web search sources for inline <cite> pills */
  searchSources?: SearchSource[];
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins: PluggableList = [
  rehypeRaw,
  rehypeHighlight,
  [rehypeKatex, { throwOnError: false, strict: false, output: "html" }],
];

function extractLanguage(node: Element | undefined): string | null {
  const child = node?.children?.[0];
  if (!child || child.type !== "element" || child.tagName !== "code") return null;
  const classes = child.properties?.className;
  const classStr = Array.isArray(classes)
    ? classes.join(" ")
    : String(classes ?? "");
  return classStr.match(/language-(\w+)/)?.[1] ?? null;
}

function extractCode(node: Element | undefined): string {
  const child = node?.children?.[0];
  if (!child || child.type !== "element") return "";
  return hastToText(child);
}

function citeText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(citeText).join("");
  return "";
}

function buildComponents(
  previewTargetId?: string,
  searchSources?: SearchSource[]
): Components {
  return {
    cite({ children }) {
      if (!searchSources?.length) return <cite>{children}</cite>;
      const indices = parseCiteIndices(citeText(children));
      return <SourceCite indices={indices} sources={searchSources} />;
    },
    pre({ children, node, ...props }) {
      const el = node as Element | undefined;
      const lang = extractLanguage(el);
      const code = extractCode(el);
      return (
        <CodeBlock
          lang={lang}
          code={code}
          previewTargetId={previewTargetId}
          preProps={props}
        >
          {children}
        </CodeBlock>
      );
    },
    code({ className, children, ...props }) {
      const isBlock =
        className?.includes("language-") || className?.includes("hljs");
      if (isBlock) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code className="inline-code" {...props}>
          {children}
        </code>
      );
    },
  };
}

export function MarkdownContent({
  content,
  className,
  previewTargetId,
  searchSources,
}: MarkdownContentProps) {
  const components = useMemo(
    () => buildComponents(previewTargetId, searchSources),
    [previewTargetId, searchSources]
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
