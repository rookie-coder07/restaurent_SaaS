import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_EMAIL = 'test@example.com';
const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

const IMAGE_LIBRARY = {
  indian_curry: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=80',
  biryani: 'https://images.unsplash.com/photo-1563379091339-03246963d51a?auto=format&fit=crop&w=1200&q=80',
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=80',
  pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80',
  noodles: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=1200&q=80',
  sandwich: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1200&q=80',
  salad: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=1200&q=80',
  fries: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=1200&q=80',
  dessert: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=80',
  ice_cream: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=80',
  coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1200&q=80',
  grilled_chicken: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1200&q=80',
  generic_food: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80',
};

const KEYWORD_IMAGE_MAP = [
  { keywords: ['paneer', 'masala', 'curry', 'dal', 'korma', 'tikka masala'], imageKey: 'indian_curry' },
  { keywords: ['biryani', 'pulao', 'fried rice'], imageKey: 'biryani' },
  { keywords: ['burger', 'cheeseburger', 'sandwich'], imageKey: 'burger' },
  { keywords: ['pizza'], imageKey: 'pizza' },
  { keywords: ['pasta', 'alfredo', 'spaghetti', 'penne', 'macaroni'], imageKey: 'pasta' },
  { keywords: ['noodles', 'ramen', 'hakka', 'chowmein'], imageKey: 'noodles' },
  { keywords: ['wrap', 'roll', 'club sandwich', 'grilled sandwich'], imageKey: 'sandwich' },
  { keywords: ['salad'], imageKey: 'salad' },
  { keywords: ['fries', 'wedges'], imageKey: 'fries' },
  { keywords: ['cake', 'brownie', 'pastry', 'gulab jamun', 'dessert'], imageKey: 'dessert' },
  { keywords: ['ice cream', 'gelato', 'kulfi'], imageKey: 'ice_cream' },
  { keywords: ['coffee', 'espresso', 'cappuccino', 'latte', 'mocha'], imageKey: 'coffee' },
  { keywords: ['tea', 'chai'], imageKey: 'tea' },
  { keywords: ['chicken', 'wings', 'grill'], imageKey: 'grilled_chicken' },
];

const PLACEHOLDER_PATTERNS = [
  'placeholder',
  'via.placeholder',
  'localhost',
  'default',
  'sample',
  '/blank',
  'dummyimage',
];

const normalizeName = (value) => value.toLowerCase().trim();

const isMissingOrPlaceholderImage = (imageUrl) => {
  if (!imageUrl) {
    return true;
  }

  const normalizedUrl = imageUrl.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => normalizedUrl.includes(pattern));
};

const resolveImageUrl = (itemName) => {
  const normalizedName = normalizeName(itemName);
  const matchedRule = KEYWORD_IMAGE_MAP.find(({ keywords }) =>
    keywords.some((keyword) => normalizedName.includes(keyword))
  );

  return IMAGE_LIBRARY[matchedRule?.imageKey || 'generic_food'];
};

const buildSearchKeyword = (itemName) => {
  const normalizedName = itemName.trim().toLowerCase();

  if (normalizedName.includes('biryani')) return `${itemName} dish`;
  if (normalizedName.includes('paneer')) return `${itemName} indian food`;
  if (normalizedName.includes('burger')) return `${itemName} food`;
  if (normalizedName.includes('pizza')) return `${itemName} pizza`;

  return `${itemName} food`;
};

const getTargetRestaurant = async (supabaseClient) => {
  const { data, error } = await supabaseClient
    .from('restaurants')
    .select('id, name, email')
    .eq('email', TARGET_EMAIL.toLowerCase())
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`No restaurant found for ${TARGET_EMAIL}`);
  }

  return data;
};

const getMenuItems = async (supabaseClient, restaurantId) => {
  const { data, error } = await supabaseClient
    .from('menu_items')
    .select('id, name, image_url, restaurant_id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

const updateMenuItemImage = async (supabaseClient, itemId, imageUrl) => {
  const { error } = await supabaseClient
    .from('menu_items')
    .update({
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);

  if (error) {
    throw error;
  }
};

const main = async () => {
  const [{ default: supabase }, cloudinaryModule] = await Promise.all([
    import('../src/config/supabase.js'),
    import('../src/config/cloudinary.js'),
  ]);
  const { initCloudinary, uploadToCloudinary } = cloudinaryModule;

  console.log('=== Menu Image Seeder ===');
  console.log(`Target account: ${TARGET_EMAIL}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);

  initCloudinary();

  const restaurant = await getTargetRestaurant(supabase);
  console.log(`Restaurant found: ${restaurant.name} (${restaurant.id})`);

  const menuItems = await getMenuItems(supabase, restaurant.id);
  console.log(`Total menu items found: ${menuItems.length}`);

  const itemsToUpdate = menuItems.filter((item) => isMissingOrPlaceholderImage(item.image_url));
  console.log(`Menu items needing images: ${itemsToUpdate.length}`);

  let updatedCount = 0;
  let skippedCount = menuItems.length - itemsToUpdate.length;

  for (const item of itemsToUpdate) {
    try {
      const imageUrl = resolveImageUrl(item.name);
      const keyword = buildSearchKeyword(item.name);
      console.log(`\n-> ${item.name}`);
      console.log(`   Keyword: ${keyword}`);
      console.log(`   Source image: ${imageUrl}`);

      if (isDryRun) {
        console.log('   Dry run only: skipping Cloudinary upload and database update');
        updatedCount += 1;
        continue;
      }

      const uploadResult = await uploadToCloudinary(imageUrl, 'seeded-menu-images');
      await updateMenuItemImage(supabase, item.id, uploadResult.url);

      updatedCount += 1;
      console.log(`   Updated with Cloudinary URL: ${uploadResult.url}`);
    } catch (error) {
      skippedCount += 1;
      console.error(`   Failed to update ${item.name}: ${error.message}`);
    }
  }

  console.log('\n=== Done ===');
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
};

main().catch((error) => {
  console.error('\nMenu image seeding failed.');
  console.error(error);
  process.exit(1);
});
