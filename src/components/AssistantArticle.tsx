"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import { DiagramPending, DiagramRenderer } from "@/components/DiagramRenderer";
import { SearchImageLayout } from "@/components/SearchImageLayout";
import { parseDiagramSegments } from "@/lib/diagram";
import {
  inferImageLayout,
  parseImageLayout,
  splitAtImageMarker,
  splitLeadParagraph,
  stripImageMarkers,
  type ImageLayout,
} from "@/lib/search/layout";
import type { SearchImage, SearchSource } from "@/types";

interface AssistantArticleProps {
  content: string;
  images: SearchImage[];
  searchSources: SearchSource[];
  previewTargetId?: string;
  /** When true, an unclosed <redstone-diagram> is treated as complete. */
  streamComplete?: boolean;
}

interface MarkdownArticleBodyProps {
  content: string;
  images: SearchImage[];
  searchSources: SearchSource[];
  previewTargetId?: string;
  chosenLayout: ImageLayout | null;
}

function MarkdownArticleBody({
  content,
  images,
  searchSources,
  previewTargetId,
  chosenLayout,
}: MarkdownArticleBodyProps) {
  const body = stripImageMarkers(content);
  const image = images[0] ? [images[0]] : [];
  const hasImage = image.length > 0;
  const layout: ImageLayout =
    chosenLayout === "journal"
      ? "float-right"
      : (chosenLayout ?? inferImageLayout(image));
  const marker = splitAtImageMarker(body);
  const split = marker ? null : splitLeadParagraph(body);

  const markdown = (text: string, withPreview?: boolean) =>
    text.trim() ? (
      <MarkdownContent
        content={text}
        className="prose max-w-none"
        searchSources={searchSources}
        previewTargetId={withPreview ? previewTargetId : undefined}
      />
    ) : null;

  const figure = hasImage ? (
    <SearchImageLayout images={image} layout={layout} />
  ) : null;

  if (marker && hasImage) {
    return (
      <>
        {markdown(marker.before)}
        {figure}
        {markdown(marker.after, true)}
      </>
    );
  }

  const isFloat = layout === "float-right" || layout === "float-left";

  if (isFloat && hasImage) {
    return (
      <>
        {split?.lead && markdown(split.lead)}
        {figure}
        {markdown(split?.body ?? (split ? "" : body), true)}
      </>
    );
  }

  return (
    <>
      {split?.lead && markdown(split.lead)}
      {hasImage && <SearchImageLayout images={image} layout="full" />}
      {markdown(split?.body ?? (split ? "" : body), true)}
    </>
  );
}

export function AssistantArticle({
  content,
  images,
  searchSources,
  previewTargetId,
  streamComplete = true,
}: AssistantArticleProps) {
  const { layout: chosenLayout, content: rawBody } = parseImageLayout(content);
  const segments = parseDiagramSegments(rawBody, { streamComplete });
  const hasDiagram = segments.some(
    (s) => s.type === "diagram" || s.type === "diagram-pending"
  );

  if (segments.length === 1 && segments[0].type === "markdown") {
    return (
      <div className="journal-article">
        <MarkdownArticleBody
          content={segments[0].text}
          images={images}
          searchSources={searchSources}
          previewTargetId={previewTargetId}
          chosenLayout={chosenLayout}
        />
      </div>
    );
  }

  let firstMarkdown = true;

  return (
    <div className="journal-article">
      {segments.map((segment, index) => {
        if (segment.type === "diagram") {
          return (
            <DiagramRenderer
              key={`diagram-${index}`}
              htmlContent={segment.html}
            />
          );
        }
        if (segment.type === "diagram-pending") {
          return <DiagramPending key={`diagram-pending-${index}`} />;
        }

        const isFirstMarkdown = firstMarkdown;
        firstMarkdown = false;

        return (
          <MarkdownArticleBody
            key={`md-${index}`}
            content={segment.text}
            images={!hasDiagram && isFirstMarkdown ? images : []}
            searchSources={searchSources}
            previewTargetId={previewTargetId}
            chosenLayout={isFirstMarkdown ? chosenLayout : null}
          />
        );
      })}
    </div>
  );
}
