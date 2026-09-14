'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Send, AlertCircle, Sigma, Delete, MousePointerClick, Lightbulb } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

interface MathExpressionsProps {
  onInsert: (expression: string) => void;
  targetLabel: string | null;
}

interface ExpressionItem {
    label: string;
    value: string;
    latex?: string;
}

interface ExpressionCategory {
    category: string;
    expressions: ExpressionItem[];
}

// Improved LaTeX Validator - More conservative and accurate
const validateAndFixLatex = (latex: string): { fixed: string; isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  let fixed = latex.trim();
  
  // Don't process empty strings or plain numbers
  if (!fixed) {
    return { fixed: '', isValid: true, errors: [] };
  }

  // Check if it's just a plain number or simple text (no LaTeX needed)
  const isPlainText = /^[0-9+\-*/.()=\s]+$/.test(fixed);
  if (isPlainText) {
    return { fixed, isValid: true, errors: [] };
  }

  // Only apply fixes to actual LaTeX content
  const hasLatexCommands = /\\[a-zA-Z]|\\[^a-zA-Z\s]|\{|\}|\[|\]|\^|_/.test(fixed);
  
  if (hasLatexCommands) {
    const fixes = [
      // Fix fraction formatting - only if it's malformed
      { 
        regex: /\\frac([^{])/g, 
        replacement: '\\frac{$1',
        error: 'Malformed fraction command'
      },
      // Fix exponents without braces
      {
        regex: /\\\^([^{][a-zA-Z0-9])/g,
        replacement: '^{$1}',
        error: 'Missing braces in exponent'
      },
      // Fix subscripts without braces
      {
        regex: /_([^{][a-zA-Z0-9])/g,
        replacement: '_{$1}',
        error: 'Missing braces in subscript'
      },
    ];

    fixes.forEach(fix => {
      const original = fixed;
      fixed = fixed.replace(fix.regex, fix.replacement);
      if (original !== fixed && !errors.includes(fix.error)) {
        errors.push(fix.error);
      }
    });

    // Validate braces balance
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Mismatched braces: ${openBraces} opening vs ${closeBraces} closing`);
    }

    // Check for common LaTeX syntax errors
    const commonErrors = [
      { pattern: /\\[a-zA-Z]+\{[^{]*$/, issue: 'Unclosed LaTeX command' },
      { pattern: /\\frac[^{]/, issue: 'Malformed fraction' },
      { pattern: /\\sqrt[^[]*[^{]*$/, issue: 'Malformed square root' },
    ];

    commonErrors.forEach(({ pattern, issue }) => {
      if (pattern.test(fixed)) {
        errors.push(issue);
      }
    });
  }

  return {
    fixed,
    isValid: errors.length === 0,
    errors
  };
};

const expressionCategories: ExpressionCategory[] = [
    {
      category: "Basic Operations",
      expressions: [
        { label: "+", value: " + ", latex: " + " },
        { label: "−", value: " - ", latex: " - " },
        { label: "×", value: " \\times ", latex: " \\times " },
        { label: "÷", value: " \\div ", latex: " \\div " },
        { label: "=", value: " = ", latex: " = " },
        { label: "(", value: "(", latex: "(" },
        { label: ")", value: ")", latex: ")" },
      ]
    },
    {
      category: "Fractions & Division",
      expressions: [
        { label: "Simple Fraction", value: "\\frac{a}{b}", latex: "\\frac{a}{b}" },
        { label: "x/y", value: "\\frac{x}{y}", latex: "\\frac{x}{y}" },
        { label: "(a+b)/(c+d)", value: "\\frac{a+b}{c+d}", latex: "\\frac{a+b}{c+d}" },
      ]
    },
    {
      category: "Exponents & Powers",
      expressions: [
        { label: "x²", value: "x^{2}", latex: "x^{2}" },
        { label: "x³", value: "x^{3}", latex: "x^{3}" },
        { label: "xⁿ", value: "x^{n}", latex: "x^{n}" },
        { label: "x⁻¹", value: "x^{-1}", latex: "x^{-1}" },
      ]
    },
    {
      category: "Roots & Radicals",
      expressions: [
        { label: "√x", value: "\\sqrt{x}", latex: "\\sqrt{x}" },
        { label: "∛x", value: "\\sqrt[3]{x}", latex: "\\sqrt[3]{x}" },
        { label: "√(x+y)", value: "\\sqrt{x+y}", latex: "\\sqrt{x+y}" },
      ]
    },
    {
      category: "Common Expressions",
      expressions: [
        { 
          label: "Quadratic Formula", 
          value: "x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}", 
          latex: "x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}" 
        },
        { 
          label: "Simple Equation", 
          value: "y = mx + c", 
          latex: "y = mx + c" 
        },
      ]
    },
];

export default function MathExpressions({ onInsert, targetLabel }: MathExpressionsProps) {
  const [currentExpression, setCurrentExpression] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Basic Operations'])
  );
  const [showTips, setShowTips] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<{isValid: boolean; errors: string[]}>({isValid: true, errors: []});

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSymbolClick = (symbol: string) => {
    const newExpression = currentExpression + symbol;
    handleExpressionChange(newExpression);
  };

  const handleExpressionChange = (expression: string) => {
    setIsProcessing(true);
    
    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      const result = validateAndFixLatex(expression);
      setCurrentExpression(result.fixed);
      setValidationResult({isValid: result.isValid, errors: result.errors});
      setIsProcessing(false);
    }, 10);
  };

  const handleSendExpression = () => {
    if (currentExpression.trim()) {
      // Check if it's plain text or actual LaTeX
      const isPlainText = /^[0-9+\-*/.()=\s]+$/.test(currentExpression.trim());
      const hasLatexCommands = /\\[a-zA-Z]|\\[^a-zA-Z\s]|\{|\}|\[|\]|\^|_/.test(currentExpression);
      
      let expressionToInsert = currentExpression;
      
      // Only wrap in $...$ if it contains LaTeX commands
      if (hasLatexCommands && !isPlainText) {
        expressionToInsert = `$${currentExpression}$`;
      }
      
      onInsert(expressionToInsert);
      setCurrentExpression('');
      setValidationResult({isValid: true, errors: []});
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
        e.preventDefault();
        handleSendExpression();
    }
  };

  const handleClear = () => {
    setCurrentExpression('');
    setValidationResult({isValid: true, errors: []});
  };

  const handleBackspace = () => {
    if (!currentExpression) return;
    handleExpressionChange(Array.from(currentExpression).slice(0, -1).join(''));
  };

  const renderLatexPreview = (latex: string) => {
    try {
      if (!latex.trim()) {
        return <span className="text-muted-foreground">Preview here...</span>;
      }
      
      // Check if it's plain text that doesn't need LaTeX rendering
      const isPlainText = /^[0-9+\-*/.()=\s]+$/.test(latex.trim());
      if (isPlainText) {
        return <span>{latex}</span>;
      }
      
      return <InlineMath math={latex} />;
    } catch (error) {
      return <span className="text-red-500">Invalid LaTeX: {latex}</span>;
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-700 text-white overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/15 text-purple-300">
            <Sigma className="h-4 w-4" />
          </span>
          Math Expressions
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tap symbols or type, preview, then insert into the paper.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {targetLabel ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-900/30 px-2.5 py-1.5 text-xs text-emerald-200">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Insert into <span className="font-semibold">{targetLabel}</span></span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-amber-700/60 bg-amber-900/30 px-2.5 py-1.5 text-xs text-amber-200">
            <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
            <span>Click any question field first, then Insert</span>
          </div>
        )}

        <div className="space-y-2.5 rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex gap-2">
                <Input
                  value={currentExpression}
                  onChange={(e) => handleExpressionChange(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type LaTeX, e.g. \frac{a}{b}"
                  className="flex-1 font-mono text-sm bg-slate-700 border-slate-600 h-9"
                  disabled={isProcessing}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleBackspace}
                  disabled={!currentExpression || isProcessing}
                  title="Delete last character"
                  className="h-9 w-9 shrink-0 bg-slate-700 border-slate-600 hover:bg-slate-600 hover:text-white"
                >
                  <Delete className="h-4 w-4" />
                </Button>
            </div>

            <div className="rounded-md border border-slate-700 bg-white px-2 py-1.5">
              <div className="min-h-[2rem] flex items-center justify-center text-black text-base overflow-x-auto app-scrollbar-light">
                {renderLatexPreview(currentExpression)}
              </div>
            </div>

            {!validationResult.isValid && (
              <div className="flex items-start gap-2 rounded-md border border-red-700/70 bg-red-900/40 px-2.5 py-1.5 text-xs text-red-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px text-red-400" />
                <span>{validationResult.errors[0]}{validationResult.errors.length > 1 ? ` (+${validationResult.errors.length - 1} more)` : ''}</span>
              </div>
            )}

          <div className="flex gap-2">
            <Button
              onClick={handleSendExpression}
              disabled={!currentExpression.trim() || isProcessing || !targetLabel}
              title={!targetLabel ? 'Click a question field first' : `Insert into ${targetLabel}`}
              className="flex items-center gap-2 flex-1 h-9 bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Send className="h-4 w-4" />
              {isProcessing ? 'Checking...' : 'Insert'}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!currentExpression}
              className="h-9 bg-slate-700 border-slate-600 hover:bg-slate-600 hover:text-white"
            >
              Clear
            </Button>
          </div>
        </div>

        {expressionCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.category);

          return (
            <div key={category.category} className="border rounded-lg border-slate-700 overflow-hidden">
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800 transition-colors"
              >
                <span className="font-semibold text-[13px]">{category.category}</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-700/80 px-1.5 py-px text-[11px] text-slate-300">
                    {category.expressions.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-2.5 pb-2.5">
                  <div className="grid grid-cols-3 gap-1.5">
                    {category.expressions.map((expr, index) => (
                      <Button
                        key={`${expr.value}-${index}`}
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-[3.25rem] flex-col gap-1 px-1 py-1.5 bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500 text-white"
                        onClick={() => handleSymbolClick(expr.value)}
                        title={`Add ${expr.label}`}
                      >
                        <div className="text-base leading-none max-w-full overflow-hidden">
                          {renderLatexPreview(expr.latex || expr.value)}
                        </div>
                        <div className="text-[10px] leading-none text-slate-400 truncate max-w-full">
                          {expr.label}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div className="rounded-lg border border-blue-800/60 bg-blue-900/20 overflow-hidden">
          <button
            onClick={() => setShowTips((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/30 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              How to use
            </span>
            {showTips ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showTips && (
            <ul className="list-disc list-inside space-y-1 px-3 pb-3 text-xs text-blue-200/90">
              <li>Click a question field, build the expression, press Insert (or Enter)</li>
              <li>Plain text like <code className="bg-slate-700 px-1 rounded font-mono">2+2=4</code> needs no LaTeX</li>
              <li>Advanced math uses LaTeX: <code className="bg-slate-700 px-1 rounded font-mono">\frac{1}{2}</code>, <code className="bg-slate-700 px-1 rounded font-mono">x^{"{"}2{"}"}</code></li>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}