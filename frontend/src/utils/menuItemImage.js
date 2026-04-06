const PLACEHOLDER_PATTERNS = ['placeholder', 'dummyimage', 'localhost', 'default', 'sample'];

export const getMenuItemImageUrl = (item) => {
  const imageUrl = String(
    item?.cloudinaryImageUrl || item?.imageUrl || item?.image_url || ''
  ).trim();

  if (!imageUrl) {
    return '';
  }

  const normalizedUrl = imageUrl.toLowerCase();
  const isPlaceholder = PLACEHOLDER_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));

  return isPlaceholder ? '' : imageUrl;
};
