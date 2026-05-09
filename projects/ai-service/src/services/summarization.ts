import type { 
  SummaryStrategyType, 
  SummaryLengthType, 
  SummaryResult,
  SummarizeRequest 
} from '../types/summarization.js';

// Simple tokenizer (approximation: split by whitespace and punctuation)
function approximateTokenCount(text: string): number {
  return text.split(/\s+/).length;
}

// Extractive summarization - select key sentences
function extractiveSummarize(text: string, length: SummaryLengthType): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length === 0) return text;
  if (sentences.length === 1) return sentences[0].trim();
  
  // Calculate sentence scores based on word frequency
  const wordFreq: Record<string, number> = {};
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  
  words.forEach(word => {
    if (word.length > 3) { // Ignore short words
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  // Score sentences
  const sentenceScores = sentences.map(sentence => {
    const sentenceWords = sentence.toLowerCase().match(/\b\w+\b/g) || [];
    const score = sentenceWords.reduce((sum, word) => sum + (wordFreq[word] || 0), 0);
    return { sentence: sentence.trim(), score, index: sentences.indexOf(sentence) };
  });
  
  // Determine how many sentences to select
  const countMap: Record<SummaryLengthType, number> = {
    short: Math.max(1, Math.floor(sentences.length * 0.1)),
    medium: Math.max(2, Math.floor(sentences.length * 0.2)),
    long: Math.max(3, Math.floor(sentences.length * 0.3)),
  };
  
  const selectCount = countMap[length];
  
  // Select top sentences but maintain original order
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, selectCount)
    .sort((a, b) => a.index - b.index);
  
  return topSentences.map(s => s.sentence).join(' ');
}

// Abstractive summarization - generate new text (simulated)
function abstractiveSummarize(text: string, length: SummaryLengthType, focus?: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const firstFew = sentences.slice(0, 3).join(' ');
  
  const lengthPrefixes: Record<SummaryLengthType, string> = {
    short: 'In brief: ',
    medium: 'Summary: ',
    long: 'Comprehensive Summary: ',
  };
  
  const focusText = focus ? ` Focusing on ${focus}.` : '';
  
  // Simulated abstractive summary (in production, this calls OpenAI/Anthropic)
  return `${lengthPrefixes[length]}${firstFew}${focusText} [This is a simulated abstractive summary. In production, this would use an LLM like GPT-4 or Claude to generate a true abstractive summary that synthesizes the content into new text.] This content discusses key themes and important points from the original document, presented in a concise and readable format.`;
}

// Bullet points summarization
function bulletsSummarize(text: string, length: SummaryLengthType): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  const countMap: Record<SummaryLengthType, number> = {
    short: 3,
    medium: 5,
    long: 8,
  };
  
  const bulletCount = countMap[length];
  
  // Select key sentences as bullet points
  const selectedSentences = sentences
    .filter(s => s.split(' ').length > 5) // Filter out short fragments
    .slice(0, bulletCount);
  
  const bullets = selectedSentences.map((s, i) => {
    const cleaned = s.trim().replace(/^[\s•\-\*]+/, '');
    return `• ${cleaned}`;
  });
  
  return bullets.join('\n');
}

// TL;DR format
function tldrSummarize(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const firstSentence = sentences[0]?.trim() || text.slice(0, 200);
  const lastSentence = sentences[sentences.length - 1]?.trim() || '';
  
  return `TL;DR: ${firstSentence} [...] ${lastSentence} (Key takeaway: The main point is presented concisely for quick understanding.)`;
}

// Main summarization function
export async function generateSummary(
  text: string,
  strategy: SummaryStrategyType,
  length: SummaryLengthType,
  focus?: string
): Promise<SummaryResult> {
  const startTime = Date.now();
  const inputTokens = approximateTokenCount(text);
  
  let summary: string;
  
  switch (strategy) {
    case 'extractive':
      summary = extractiveSummarize(text, length);
      break;
    case 'abstractive':
      summary = abstractiveSummarize(text, length, focus);
      break;
    case 'bullets':
      summary = bulletsSummarize(text, length);
      break;
    case 'tldr':
      summary = tldrSummarize(text);
      break;
    default:
      summary = abstractiveSummarize(text, length, focus);
  }
  
  const outputTokens = approximateTokenCount(summary);
  const processingTime = Date.now() - startTime;
  
  return {
    summary,
    inputTokens,
    outputTokens,
    processingTime,
  };
}

// Combine multiple documents
export async function combineDocuments(texts: string[]): Promise<string> {
  const separator = '\n\n---\n\n';
  return texts.join(separator);
}

// Generate cache key
export function generateCacheKey(
  text: string,
  strategy: SummaryStrategyType,
  length: SummaryLengthType,
  focus?: string
): string {
  // Simple hash for caching (in production, use proper hash like sha256)
  const normalizedText = text.slice(0, 1000); // First 1000 chars for cache key
  const focusPart = focus ? `:${focus}` : '';
  return `summary:${strategy}:${length}${focusPart}:${normalizedText.length}:${normalizedText.slice(0, 50)}`;
}
