import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import { renderPlainTextToHtml } from './text-format';
import AngleDiagram, { angleDiagramKinds } from './angle-diagram';

interface LatexRendererProps {
  content: string;
}

const LatexRenderer: React.FC<LatexRendererProps> = ({ content }) => {
  if (!content) return null;

  // Enhanced regex to handle various LaTeX delimiters
  const inlineRegex = /\$([^$]+)\$/g;
  const blockRegex = /\$\$([^$]+)\$\$/g;
  
  // Also handle \(...\) and \[...\] delimiters
  const inlineParenRegex = /\\\(([^]+?)\\\)/g;
  const blockBracketRegex = /\\\[([^]+?)\\\]/g;
  const diagramRegex = /\\angleDiagram\{(acute|right|obtuse|straight)\}/g;

  const processString = (text: string) => {
    if (!text) return [<span key="empty"></span>];

    // First, handle block-level math with different delimiters
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let currentText = text;

    // Process all math blocks first
    const blockMathIndices: Array<{start: number, end: number, content: string, type: 'block' | 'inline' | 'diagram'}> = [];

    // Find all $$...$$ blocks
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
      blockMathIndices.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'block'
      });
    }

    // Find all \[...\] blocks
    while ((match = blockBracketRegex.exec(text)) !== null) {
      blockMathIndices.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'block'
      });
    }

    // Find all $...$ inline math
    while ((match = inlineRegex.exec(text)) !== null) {
      blockMathIndices.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'inline'
      });
    }

    // Find all \(...\) inline math
    while ((match = inlineParenRegex.exec(text)) !== null) {
      blockMathIndices.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'inline'
      });
    }
    while ((match = diagramRegex.exec(text)) !== null) {
      blockMathIndices.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        type: 'diagram'
      });
    }

    // Sort by start index
    blockMathIndices.sort((a, b) => a.start - b.start);

    // If no math found, return plain text
    if (blockMathIndices.length === 0) {
      return [<span key="text-only" style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderPlainTextToHtml(text) }} />];
    }

    // Build the parts array
    lastIndex = 0;
    blockMathIndices.forEach((math, index) => {
      if (math.start < lastIndex) return;
      // Add text before math
      if (math.start > lastIndex) {
        parts.push(
          <span
            key={`text-${index}`}
            style={{ whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: renderPlainTextToHtml(text.substring(lastIndex, math.start)) }}
          />
        );
      }

      // Add math
      try {
        if (math.type === 'diagram') {
          parts.push(
            <AngleDiagram
              key={`diagram-${index}`}
              kind={math.content as (typeof angleDiagramKinds)[number]}
            />
          );
        } else if (math.type === 'block') {
          parts.push(
            <BlockMath key={`math-${index}`} math={math.content.trim()} />
          );
        } else {
          parts.push(
            <InlineMath key={`math-${index}`} math={math.content.trim()} />
          );
        }
      } catch (error) {
        parts.push(
          <span key={`math-error-${index}`} className="text-red-500" title={`Invalid LaTeX: ${math.content}`}>
            [Math Error: {math.content}]
          </span>
        );
      }

      lastIndex = math.end;
    });

    // Add remaining text after last math
    if (lastIndex < text.length) {
      parts.push(
        <span
          key="text-final"
          style={{ whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: renderPlainTextToHtml(text.substring(lastIndex)) }}
        />
      );
    }

    return parts;
  };

  return <>{processString(content)}</>;
};

export default LatexRenderer;
