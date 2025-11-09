'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';

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

  const processString = (text: string) => {
    if (!text) return [<span key="empty"></span>];

    // First, handle block-level math with different delimiters
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let currentText = text;

    // Process all math blocks first
    const blockMathIndices: Array<{start: number, end: number, content: string, type: 'block' | 'inline'}> = [];

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

    // Sort by start index
    blockMathIndices.sort((a, b) => a.start - b.start);

    // If no math found, return plain text
    if (blockMathIndices.length === 0) {
      return [<span key="text-only">{text}</span>];
    }

    // Build the parts array
    lastIndex = 0;
    blockMathIndices.forEach((math, index) => {
      // Add text before math
      if (math.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {text.substring(lastIndex, math.start)}
          </span>
        );
      }

      // Add math
      try {
        if (math.type === 'block') {
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
        <span key="text-final">
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return <>{processString(content)}</>;
};

export default LatexRenderer;