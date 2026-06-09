"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import { SearchImageLayout } from "@/components/SearchImageLayout";
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
}

export function AssistantArticle({
  content,
  images,
  searchSources,
  previewTargetId,
}: AssistantArticleProps) {
  const { layout: chosen, content: rawBody } = parseImageLayout(content);
  const body = stripImageMarkers(rawBody);
  const image = images[0] ? [images[0]] : [];
  const hasImage = image.length > 0;
  const layout: ImageLayout =
    chosen === "journal" ? "float-right" : (chosen ?? inferImageLayout(image));
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
      <div className="journal-article">
        {markdown(marker.before)}
        {figure}
        {markdown(marker.after, true)}
      </div>
    );
  }

  const isFloat = layout === "float-right" || layout === "float-left";

  if (isFloat && hasImage) {
    return (
      <div className="journal-article">
        {split?.lead && markdown(split.lead)}
        {figure}
        {markdown(split?.body ?? (split ? "" : body), true)}
      </div>
    );
  }

  return (
    <div className="journal-article">
      {split?.lead && markdown(split.lead)}
      {hasImage && <SearchImageLayout images={image} layout="full" />}
      {markdown(split?.body ?? (split ? "" : body), true)}
    </div>
  );
}
