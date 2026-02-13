/**
 * cn() utility for className concatenation
 *
 * A lightweight alternative to clsx + tailwind-merge that simply
 * filters out falsy values and joins non-empty strings with spaces.
 *
 * Usage:
 *   cn('base-class', condition && 'conditional-class', 'another-class')
 *   // => 'base-class conditional-class another-class'
 *
 * @param {...(string|boolean|undefined|null)} inputs - Class names or conditional expressions
 * @returns {string} - Concatenated className string
 */
export function cn(...inputs: (string | boolean | undefined | null)[]) {
  return inputs
    .filter((input): input is string => Boolean(input) && typeof input === 'string')
    .join(' ')
    .trim();
}
