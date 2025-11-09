'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Send, AlertCircle, CheckCircle } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

interface MathExpressionsProps {
  onInsert: (expression: string) => void;
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

export default function MathExpressions({ onInsert }: MathExpressionsProps) {
  const [currentExpression, setCurrentExpression] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Basic Operations', 'Fractions & Division'])
  );
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
    <Card className="bg-slate-900 border-slate-700 text-white">
      <CardHeader>
        <CardTitle>Math Expressions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Build mathematical expressions with automatic validation
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 p-4 border rounded-lg bg-slate-800">
            <div>
                <Input
                  value={currentExpression}
                  onChange={(e) => handleExpressionChange(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter math expression or LaTeX code..."
                  className="flex-1 font-mono text-sm bg-slate-700 border-slate-600"
                  disabled={isProcessing}
                />
            </div>
            
            {/* Validation Status */}
            {!validationResult.isValid && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <span className="font-semibold">LaTeX Issues Found:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-red-300">
                  {validationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {validationResult.isValid && currentExpression && (
              <div className="flex items-center gap-2 p-2 bg-green-900/50 border border-green-700 rounded text-xs text-green-300">
                <CheckCircle className="h-4 w-4" />
                <span>Expression is valid</span>
              </div>
            )}

          <div className="flex gap-2">
            <Button 
              onClick={handleSendExpression}
              disabled={!currentExpression.trim() || isProcessing}
              className="flex items-center gap-2 flex-1"
            >
              <Send className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Send'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleClear}
              disabled={!currentExpression}
              className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              Clear
            </Button>
          </div>
                    
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-md">
              <div className="text-xs text-muted-foreground mb-2">Preview:</div>
              <div className="min-h-[40px] flex items-center justify-center p-2 bg-gray-50 rounded text-black">
                {renderLatexPreview(currentExpression)}
              </div>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p>Expression: <code className="bg-slate-700 px-2 py-1 rounded border border-slate-600 font-mono text-xs break-all">{currentExpression || "(empty)"}</code></p>
          </div>
        </div>

        {expressionCategories.map((category) => {
          const isExpanded = expandedCategories.has(category.category);
          
          return (
            <div key={category.category} className="border rounded-lg border-slate-700">
              <button
                onClick={() => toggleCategory(category.category)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="font-semibold text-sm">{category.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {category.expressions.length}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
              
              {isExpanded && (
                <div className="p-3 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {category.expressions.map((expr, index) => (
                      <Button
                        key={`${expr.value}-${index}`}
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 px-2 justify-center items-center min-h-[3rem] flex flex-col bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                        onClick={() => handleSymbolClick(expr.value)}
                        title={expr.label}
                      >
                        <div className="text-xs text-muted-foreground mb-1">
                          {expr.label}
                        </div>
                        <div className="text-sm">
                          {renderLatexPreview(expr.latex || expr.value)}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <div className="p-3 bg-blue-900/50 border border-blue-700 rounded-lg text-xs text-blue-300">
          <p className="font-semibold mb-2">💡 How to use:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Simple numbers and equations don't need LaTeX</li>
            <li>Use templates for complex expressions</li>
            <li>Plain text: <code>15</code>, <code>2+2=4</code></li>
            <li>LaTeX for advanced math: <code>\frac{1}{2}</code>, <code>x^{2}</code></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}