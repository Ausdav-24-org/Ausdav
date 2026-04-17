import { importFacebookUrl } from '@/services/facebookImportService';

/**
 * Extract images from Facebook post/album using backend function
 * Falls back to Open Graph if backend fails
 */
export async function extractImagesFromFacebookPost(postUrl: string): Promise<string[]> {
  try {
    // Try backend function first (better for albums)
    const response = await importFacebookUrl({
      facebook_url: postUrl,
      content_type: 'auto_detect',
      force_resync: false,
    });

    if (response?.ok && response.images && response.images.length > 0) {
      // Extract up to 30 image URLs from imported images
      const imageUrls = response.images
        .slice(0, 30)
        .map((img) => img.image_url_original)
        .filter((url) => url && typeof url === 'string');

      if (imageUrls.length > 0) {
        return imageUrls;
      }
    }
  } catch (error: any) {
    console.warn(`Backend function failed for ${postUrl}, trying fallback:`, error?.message);
    // Continue to fallback method
  }

  // Fallback: Try to extract OG image from Facebook using Microlink
  try {
    const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(postUrl)}`;
    
    const response = await fetch(microlinkUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`Microlink API failed for ${postUrl}:`, response.status);
      return [];
    }

    const data = await response.json();
    
    // Microlink returns OG image in data.data.image.url
    if (data?.data?.image?.url) {
      return [data.data.image.url];
    }

    return [];
  } catch (error) {
    console.warn(`Error extracting image from ${postUrl}:`, error);
    return [];
  }
}

/**
 * Batch extract images from multiple Facebook post URLs
 * Returns array of image URLs from all posts (up to 30 per post)
 * Deduplicates images by URL to avoid showing the same image multiple times
 */
export async function extractImagesFromFacebookPosts(
  postUrls: Record<string, string>
): Promise<Array<{ postUrl: string; imageUrl: string }>> {
  const results: Array<{ postUrl: string; imageUrl: string }> = [];
  const seenUrls = new Set<string>(); // Track seen image URLs to deduplicate

  // Process URLs sequentially to avoid rate limiting
  const urlEntries = Object.entries(postUrls);

  for (const [, postUrl] of urlEntries) {
    try {
      const imageUrls = await extractImagesFromFacebookPost(postUrl);
      
      // Add each image, but skip duplicates
      imageUrls.forEach((imageUrl) => {
        if (imageUrl && !seenUrls.has(imageUrl)) {
          seenUrls.add(imageUrl);
          results.push({ postUrl, imageUrl });
        }
      });
    } catch (error) {
      console.warn(`Error processing ${postUrl}:`, error);
      // Continue with next URL even if one fails
    }
  }

  return results;
}
