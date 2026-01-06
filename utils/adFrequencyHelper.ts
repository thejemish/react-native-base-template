/**
 * Helper functions for determining ad positions based on ad_frequency
 */

/**
 * Check if an item at the given index should display a native ad after it
 * Based on ad_frequency: 
 * - If frequency is 1: row 1, ad 1, row 2, ad 2, row 3, ad 3...
 * - If frequency is 2: row 1, row 2, ad 1, row 3, row 4, ad 2...
 * 
 * @param contentIndex - The index of the content item in the original list (0-based)
 * @param adFrequency - The ad frequency from Supabase (default: 1)
 * @returns true if an ad should be displayed after this content item
 * 
 * @example
 * // ad_frequency = 1: show ad after every content item
 * shouldShowAd(0, 1) // true (show ad after row 1)
 * shouldShowAd(1, 1) // true (show ad after row 2)
 * shouldShowAd(2, 1) // true (show ad after row 3)
 * 
 * // ad_frequency = 2: show ad after every 2 content items
 * shouldShowAd(0, 2) // false
 * shouldShowAd(1, 2) // true (show ad after row 2)
 * shouldShowAd(2, 2) // false
 * shouldShowAd(3, 2) // true (show ad after row 4)
 */
export function shouldShowAd(contentIndex: number, adFrequency: number = 1): boolean {
  // For ad_frequency = 1: show ad after every content item (alternating)
  // Pattern: row 1, ad 1, row 2, ad 2, row 3, ad 3...
  // This means: show ad after content at index 0, 1, 2, 3...
  
  if (adFrequency === 1) {
    // Show ad after every content item
    return true;
  }
  
  // For other frequencies: show ad after every N content items
  // ad_frequency = 2: show ad after content at index 1, 3, 5... (after every 2 items)
  // ad_frequency = 3: show ad after content at index 2, 5, 8... (after every 3 items)
  return (contentIndex + 1) % adFrequency === 0;
}

/**
 * Calculate the total number of items including ads for a given number of content items
 * 
 * @param contentCount - Number of content items
 * @param adFrequency - The ad frequency from Supabase
 * @returns Total count including ads
 */
export function calculateTotalItemCount(contentCount: number, adFrequency: number = 1): number {
  if (adFrequency === 1) {
    // Every position after the first has an ad
    return contentCount + (contentCount > 0 ? contentCount - 1 : 0);
  }
  
  // Calculate how many ad positions we'll have
  let adCount = 0;
  for (let i = 0; i < contentCount; i++) {
    if (shouldShowAd(i, adFrequency)) {
      adCount++;
    }
  }
  
  return contentCount + adCount;
}

/**
 * Get the type of item at a given index (either 'content' or 'ad')
 * 
 * @param index - The index in the combined list (content + ads)
 * @param adFrequency - The ad frequency from Supabase
 * @param contentIndex - The current content index being processed
 * @returns 'ad' if this position should show an ad, 'content' otherwise
 */
export function getItemType(
  index: number,
  adFrequency: number = 1,
  contentIndex: number
): 'content' | 'ad' {
  // Check if this position should have an ad based on the content index
  return shouldShowAd(contentIndex, adFrequency) ? 'ad' : 'content';
}

