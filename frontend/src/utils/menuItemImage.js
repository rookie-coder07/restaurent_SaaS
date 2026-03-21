const FOOD_IMAGE_MAP = [
  {
    keywords: ['paneer', 'masala', 'curry', 'dal', 'korma', 'tikka masala'],
    imageUrl: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['biryani', 'pulao', 'fried rice'],
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['burger', 'cheeseburger', 'sandwich'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['pizza'],
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['pasta', 'alfredo', 'spaghetti', 'penne', 'macaroni'],
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['noodles', 'ramen', 'hakka', 'chowmein'],
    imageUrl: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['salad'],
    imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['fries', 'wedges'],
    imageUrl: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['cake', 'brownie', 'pastry', 'dessert', 'gulab jamun'],
    imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['ice cream', 'gelato', 'kulfi'],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['coffee', 'espresso', 'cappuccino', 'latte', 'mocha'],
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['tea', 'chai'],
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1200&q=80',
  },
  {
    keywords: ['chicken', 'grill', 'wings'],
    imageUrl: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
  },
];

const GENERIC_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80';

const PLACEHOLDER_PATTERNS = ['placeholder', 'dummyimage', 'localhost', 'default', 'sample'];

export const getMenuItemImageUrl = (item) => {
  if (item?.cloudinaryImageUrl) {
    const normalizedUrl = item.cloudinaryImageUrl.toLowerCase();
    const isPlaceholder = PLACEHOLDER_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));

    if (!isPlaceholder) {
      return item.cloudinaryImageUrl;
    }
  }

  const normalizedName = item?.name?.toLowerCase().trim() || '';
  const matchedRule = FOOD_IMAGE_MAP.find(({ keywords }) =>
    keywords.some((keyword) => normalizedName.includes(keyword))
  );

  return matchedRule?.imageUrl || GENERIC_FOOD_IMAGE;
};
