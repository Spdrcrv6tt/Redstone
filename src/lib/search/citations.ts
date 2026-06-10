import { stripDiagramBlocks } from "@/lib/diagram";
import { protectImageBlocks, stripImageBlocks } from "@/lib/image-gen";
import { protectStudyBlocks, stripStudyBlocks } from "@/lib/study";
import { protectWidgetBlocks, stripWidgetBlocks } from "@/lib/widget";
import { stripImageLayoutTag } from "@/lib/search/layout";

/** Remove bracketed source markers like [1], [2, 3] from model output. */
export function stripInlineCitations(text: string): string {
  return text.replace(/\s*\[(?:\d+\s*(?:,\s*\d+)*)\]/g, "");
}

/** Drop opening lines that meta-comment on images (safety net for the model). */
export function stripImageAcknowledgments(text: string): string {
  const patterns = [
    /^[^\n]*\b(?:images?|photos?|pictures?|illustrations?)\b[^\n]*\b(?:available|shown|found|provided|below|above|displayed|included)\b[^\n]*\n+/i,
    /^[^\n]*\b(?:here (?:is|are)|there (?:is|are))\b[^\n]*\b(?:images?|photos?|pictures?)\b[^\n]*\n+/i,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }
  return result;
}

/** Remove <cite> tags for plain-text copy. */
export function stripCiteTags(text: string): string {
  return text.replace(/<cite>[^<]*<\/cite>/gi, "");
}

/** Remove markdown images and bare image URLs the model should not emit. */
export function stripLeakedImageMarkup(text: string): string {
  let result = text.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  result = result.replace(
    /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/gi,
    ""
  );
  result = result.replace(/httpshttps:\/\//gi, "https://");
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

/** Strip photo catalogue prose when no image was shown. */
export function stripPhotoCatalogue(text: string): string {
  const patterns = [
    /^[^\n]*\b(?:historical )?photographs?\s+(?:from|include|show)\b[^\n]*\n+/i,
    /^[^\n]*\b(?:documented |newly released )?photos?\s+(?:show|include)\b[^\n]*\n+/i,
    /^[^\n]*\bother documented photos\b[^\n]*\n+/i,
    /\n(?:Other documented|Historical) photos?[^\n]*\n[\s\S]*$/i,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }
  return result.trim();
}

/** Strip meta-commentary about disambiguating namesakes. */
export function stripNamesakeDisambiguation(text: string): string {
  const patterns = [
    /^[^\n]*\b(?:several|many|other)\s+famous\s+people\s+named\b[^\n]*\n+/i,
    /^[^\n]*\b(?:since your previous|because there are)\b[^\n]*\n+/i,
    /^[^\n]*\bI have included information on others\b[^\n]*\n+/i,
    /\n#{1,3}\s*Other Famous \w+[^\n]*\n[\s\S]*$/i,
    /\n\*\*Other Famous \w+\*\*[^\n]*\n[\s\S]*$/i,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }
  return result.trim();
}

/** Model sometimes emits label-style brackets instead of <cite> tags. */
export function stripHallucinatedCiteBrackets(text: string): string {
  return text.replace(/\s*\[(?!\d)(?:[^\]]{2,100})\]/g, "");
}

/** Collapse runs of adjacent cite tags into one. */
export function collapseAdjacentCites(text: string): string {
  return text.replace(
    /(<cite>[^<]*<\/cite>)(\s*<cite>[^<]*<\/cite>)+/gi,
    "$1"
  );
}

/** Cap inline cites — one per paragraph, limited total. */
export function thinCitations(text: string, maxTotal = 2): string {
  const parts = text.split(/(\n\n+)/);
  let total = 0;

  return parts
    .map((part) => {
      if (/^\n+$/.test(part)) return part;
      let usedInParagraph = false;
      return part.replace(/<cite>[^<]*<\/cite>/gi, (match) => {
        if (usedInParagraph || total >= maxTotal) return "";
        usedInParagraph = true;
        total++;
        return match;
      });
    })
    .join("");
}

export function cleanSearchResponse(
  text: string,
  options?: { imagesAttached?: boolean }
): string {
  const source = options?.imagesAttached ? stripImageBlocks(text) : text;
  const { text: widgetShielded, restore: restoreWidgets } =
    protectWidgetBlocks(source);
  const { text: imageShielded, restore: restoreImages } =
    protectImageBlocks(widgetShielded);
  const { text: shielded, restore: restoreStudy } =
    protectStudyBlocks(imageShielded);
  const restore = (cleaned: string) =>
    restoreWidgets(restoreImages(restoreStudy(cleaned)));

  let result = stripInlineCitations(shielded);
  result = stripHallucinatedCiteBrackets(result);
  result = collapseAdjacentCites(result);
  result = thinCitations(result);
  result = stripImageAcknowledgments(result);
  result = stripNamesakeDisambiguation(result);
  result = stripPhotoCatalogue(result);

  if (options?.imagesAttached) {
    result = stripLeakedImageMarkup(result);
  }

  return restore(result);
}

/** Plain prose for clipboard — no cite tags or legacy markers. */
export function plainSearchResponse(text: string): string {
  let t = stripStudyBlocks(
    stripImageBlocks(
      stripWidgetBlocks(
        stripDiagramBlocks(
          stripImageLayoutTag(stripCiteTags(cleanSearchResponse(text)))
        )
      )
    )
  );
  return t.replace(/<img-here\s*\/?>/gi, "").trim();
}
