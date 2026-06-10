"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import {
  DynamicWidgetLoader,
  WidgetArchitectPending,
} from "@/components/DynamicWidgetLoader";
import {
  FlashcardDeck,
  FlashcardDeckPending,
} from "@/components/FlashcardDeck";
import { ImageArchitectPending, ImageLoader } from "@/components/ImageLoader";
import { LinkCardRow } from "@/components/LinkCardRow";
import { SearchImageLayout } from "@/components/SearchImageLayout";
import { StudyQuiz, StudyQuizPending } from "@/components/StudyQuiz";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { parseContentSegments } from "@/lib/widget";
import {
  inferImageLayout,
  parseImageLayout,
  splitAtImageMarker,
  splitAtVideoMarker,
  splitLeadParagraph,
  stripImageMarkers,
  type ImageLayout,
} from "@/lib/search/layout";
import type { SearchImage, SearchLink, SearchSource, SearchVideo } from "@/types";

interface AssistantArticleProps {
  content: string;
  images: SearchImage[];
  videos?: SearchVideo[];
  links?: SearchLink[];
  searchSources: SearchSource[];
  previewTargetId?: string;
  streamComplete?: boolean;
  model?: string;
  onWidgetBuilt?: (widgetIndex: number, html: string) => void;
  onImageBuilt?: (imageIndex: number, url: string) => void;
}

interface MarkdownArticleBodyProps {
  content: string;
  images: SearchImage[];
  videos: SearchVideo[];
  links: SearchLink[];
  searchSources: SearchSource[];
  previewTargetId?: string;
  chosenLayout: ImageLayout | null;
  showLinks: boolean;
}

function MarkdownArticleBody({
  content,
  images,
  videos,
  links,
  searchSources,
  previewTargetId,
  chosenLayout,
  showLinks,
}: MarkdownArticleBodyProps) {
  const body = stripImageMarkers(content);
  const image = images[0] ? [images[0]] : [];
  const hasImage = image.length > 0;
  const hasVideo = videos.length > 0;
  const layout: ImageLayout =
    chosenLayout === "journal"
      ? "float-right"
      : (chosenLayout ?? inferImageLayout(image));
  const imageMarker = splitAtImageMarker(body);
  const videoMarker = !imageMarker ? splitAtVideoMarker(body) : null;
  const split =
    imageMarker || videoMarker ? null : splitLeadParagraph(body);

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

  const videoEmbed = hasVideo ? <YouTubeEmbed videos={videos} /> : null;
  const linkRow = showLinks && links.length > 0 ? (
    <LinkCardRow links={links} />
  ) : null;

  if (videoMarker && hasVideo) {
    return (
      <>
        {markdown(videoMarker.before)}
        {videoEmbed}
        {markdown(videoMarker.after, true)}
        {linkRow}
      </>
    );
  }

  if (imageMarker && hasImage) {
    return (
      <>
        {markdown(imageMarker.before)}
        {figure}
        {markdown(imageMarker.after, true)}
        {hasVideo && videoEmbed}
        {linkRow}
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
        {hasVideo && videoEmbed}
        {linkRow}
      </>
    );
  }

  return (
    <>
      {split?.lead && markdown(split.lead)}
      {hasImage && <SearchImageLayout images={image} layout="full" />}
      {hasVideo && videoEmbed}
      {markdown(split?.body ?? (split ? "" : body), true)}
      {linkRow}
    </>
  );
}

export function AssistantArticle({
  content,
  images,
  videos = [],
  links = [],
  searchSources,
  previewTargetId,
  streamComplete = true,
  model,
  onWidgetBuilt,
  onImageBuilt,
}: AssistantArticleProps) {
  const { layout: chosenLayout, content: rawBody } = parseImageLayout(content);
  const segments = parseContentSegments(rawBody, { streamComplete });
  const hasRichEmbed = segments.some(
    (s) =>
      s.type === "widget" ||
      s.type === "widget-pending" ||
      s.type === "image" ||
      s.type === "image-pending" ||
      s.type === "flashcards" ||
      s.type === "flashcards-pending" ||
      s.type === "quiz" ||
      s.type === "quiz-pending"
  );

  if (segments.length === 1 && segments[0].type === "markdown") {
    return (
      <div className="journal-article">
        <MarkdownArticleBody
          content={segments[0].text}
          images={images}
          videos={videos}
          links={links}
          searchSources={searchSources}
          previewTargetId={previewTargetId}
          chosenLayout={chosenLayout}
          showLinks
        />
      </div>
    );
  }

  let firstMarkdown = true;
  let widgetOrdinal = 0;
  let imageOrdinal = 0;

  return (
    <div className="journal-article">
      {segments.map((segment, index) => {
        if (segment.type === "widget") {
          const widgetIndex = widgetOrdinal++;
          return (
            <DynamicWidgetLoader
              key={`widget-${widgetIndex}`}
              spec={segment.spec.props.spec}
              height={segment.spec.props.height}
              cachedHtml={segment.spec.props.html}
              model={model}
              onBuilt={(html) => onWidgetBuilt?.(widgetIndex, html)}
            />
          );
        }
        if (segment.type === "widget-pending") {
          return <WidgetArchitectPending key={`widget-pending-${index}`} />;
        }
        if (segment.type === "image") {
          const imageIndex = imageOrdinal++;
          return (
            <ImageLoader
              key={`image-${imageIndex}`}
              spec={segment.spec}
              model={model}
              onBuilt={(url) => onImageBuilt?.(imageIndex, url)}
            />
          );
        }
        if (segment.type === "image-pending") {
          return <ImageArchitectPending key={`image-pending-${index}`} />;
        }
        if (segment.type === "flashcards") {
          return <FlashcardDeck key={`flashcards-${index}`} deck={segment.spec} />;
        }
        if (segment.type === "flashcards-pending") {
          return <FlashcardDeckPending key={`flashcards-pending-${index}`} />;
        }
        if (segment.type === "quiz") {
          return <StudyQuiz key={`quiz-${index}`} quiz={segment.spec} />;
        }
        if (segment.type === "quiz-pending") {
          return <StudyQuizPending key={`quiz-pending-${index}`} />;
        }

        const isFirstMarkdown = firstMarkdown;
        firstMarkdown = false;

        return (
          <MarkdownArticleBody
            key={`md-${index}`}
            content={segment.text}
            images={!hasRichEmbed && isFirstMarkdown ? images : []}
            videos={!hasRichEmbed && isFirstMarkdown ? videos : []}
            links={links}
            searchSources={searchSources}
            previewTargetId={previewTargetId}
            chosenLayout={isFirstMarkdown ? chosenLayout : null}
            showLinks={isFirstMarkdown}
          />
        );
      })}
    </div>
  );
}
