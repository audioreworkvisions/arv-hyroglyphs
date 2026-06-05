export interface ModerationResult {
  allowed: boolean;
  sanitizedText: string;
  reason?: string;
}

const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /<script/gi,
  /free\s+followers/gi,
  /buy\s+now/gi,
];

const sanitizeText = (value: string): string => {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
};

export const basicModerationHook = (value: string): ModerationResult => {
  const sanitizedText = sanitizeText(value);

  if (!sanitizedText) {
    return {
      allowed: false,
      sanitizedText: '',
      reason: 'empty-message',
    };
  }

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(sanitizedText))) {
    return {
      allowed: false,
      sanitizedText,
      reason: 'blocked-pattern',
    };
  }

  const repetitive = /(.)\1{11,}/.test(sanitizedText);
  if (repetitive) {
    return {
      allowed: false,
      sanitizedText,
      reason: 'spam-pattern',
    };
  }

  return {
    allowed: true,
    sanitizedText,
  };
};
