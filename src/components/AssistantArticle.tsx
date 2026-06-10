"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import {
  DynamicWidgetLoader,
  WidgetArchitectPending,
} from "@/components/DynamicWidgetLoader";
import { SearchImageLayout } from "@/components/SearchImageLayout";
import { parseContentSegments } from "@/lib/widget";
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
  streamComplete?: boolean;
  model?: string;
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
  model,
}: AssistantArticleProps) {
  const { layout: chosenLayout, content: rawBody } = parseImageLayout(content);
  const segments = parseContentSegments(rawBody, { streamComplete });
  const hasWidget = segments.some(
    (s) => s.type === "widget" || s.type === "widget-pending"
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
        if (segment.type === "widget") {
          return (
            <DynamicWidgetLoader
              key={`widget-${index}`}
              spec={segment.spec.props.spec}
              height={segment.spec.props.height}
              model={model}
            />
          );
        }
        if (segment.type === "widget-pending") {
          return <WidgetArchitectPending key={`widget-pending-${index}`} />;
        }

        const isFirstMarkdown = firstMarkdown;
        firstMarkdown = false;

        return (
          <MarkdownArticleBody
            key={`md-${index}`}
            content={segment.text}
            images={!hasWidget && isFirstMarkdown ? images : []}
            searchSources={searchSources}
            previewTargetId={previewTargetId}
            chosenLayout={isFirstMarkdown ? chosenLayout : null}
          />
        );
      })}
    </div>
  );
}
