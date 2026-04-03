/**
 * Seed script for Jazzy trend data.
 * Run: node server/scripts/seed-jazzy.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const trends = [
  // ─── FREE PEOPLE ───
  {
    title: 'Folk Town Boho Maxi Dress',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/folk-town-boho-dress',
    image_url: 'https://images.unsplash.com/photo-1596783074918-c84cb06531ca?w=600&q=80',
    market: 'Missy',
    category: 'Dresses',
    description: 'Flowy maxi dress with intricate embroidery and tassel details. Earthy tones with a relaxed silhouette — perfect for the free-spirited wardrobe.',
    price_range: '$148',
    tags: ['boho', 'maxi', 'embroidered', 'flowy', 'earthy'],
  },
  {
    title: 'Daydreamer Crochet Top',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/daydreamer-crochet-top',
    image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&q=80',
    market: 'Juniors',
    category: 'Tops',
    description: 'Hand-crochet crop top with scalloped edges and adjustable ties. Festival-ready in ivory and sage green.',
    price_range: '$78',
    tags: ['crochet', 'crop', 'festival', 'handmade'],
  },
  {
    title: 'Canyon Sunset Wide-Leg Pants',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/canyon-sunset-pants',
    image_url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80',
    market: 'Missy',
    category: 'Bottoms',
    description: 'Relaxed wide-leg pants in a rust paisley print with smocked waistband. Effortlessly bohemian from day to night.',
    price_range: '$108',
    tags: ['wide-leg', 'paisley', 'smocked', 'rust'],
  },
  {
    title: 'Wildflower Tiered Mini Dress',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/wildflower-tiered-mini',
    image_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&q=80',
    market: 'Juniors',
    category: 'Dresses',
    description: 'Playful tiered mini dress with ditsy floral print and puff sleeves. Lightweight cotton in dusty blue and ivory.',
    price_range: '$98',
    tags: ['floral', 'tiered', 'mini', 'puff-sleeve', 'cotton'],
  },
  {
    title: 'Wanderer Suede Fringe Jacket',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/wanderer-fringe-jacket',
    image_url: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&q=80',
    market: 'Missy',
    category: 'Outerwear',
    description: 'Vintage-inspired suede jacket with long fringe detailing. A statement piece in warm camel with western boho vibes.',
    price_range: '$268',
    tags: ['fringe', 'suede', 'western', 'statement', 'vintage'],
  },
  {
    title: 'Luna Lace Bell-Sleeve Top',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/luna-lace-bell-sleeve',
    image_url: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&q=80',
    market: 'Juniors',
    category: 'Tops',
    description: 'Romantic lace top with dramatic bell sleeves and scalloped hem. Sheer overlay in cream — pair with a bralette.',
    price_range: '$88',
    tags: ['lace', 'bell-sleeve', 'romantic', 'sheer'],
  },
  // ─── ANTHROPOLOGIE ───
  {
    title: 'Embroidered Prairie Midi Dress',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/embroidered-prairie-midi-dress',
    image_url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80',
    market: 'Missy',
    category: 'Dresses',
    description: 'Stunning prairie midi with cross-stitch embroidery, ruffled collar, and a cinched waist. Available in sage green and ivory.',
    price_range: '$198',
    tags: ['prairie', 'embroidered', 'midi', 'ruffled', 'sage'],
  },
  {
    title: 'Artisan Patchwork Quilted Vest',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/artisan-patchwork-vest',
    image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&q=80',
    market: 'Missy',
    category: 'Outerwear',
    description: 'Handcrafted patchwork vest with quilted panels in mixed earth-tone prints. A layering essential for bohemian styling.',
    price_range: '$158',
    tags: ['patchwork', 'quilted', 'vest', 'artisan', 'earth-tone'],
  },
  {
    title: 'Woven Rattan Crossbody Bag',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/woven-rattan-crossbody',
    image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80',
    market: 'Missy',
    category: 'Accessories',
    description: 'Natural rattan crossbody with leather straps and brass clasp. Summer-ready with a relaxed, organic texture.',
    price_range: '$68',
    tags: ['rattan', 'woven', 'crossbody', 'natural', 'summer'],
  },
  {
    title: 'Saffron Paisley Wrap Skirt',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/saffron-paisley-wrap-skirt',
    image_url: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=600&q=80',
    market: 'Missy',
    category: 'Bottoms',
    description: 'Flowing wrap skirt in a rich saffron paisley print. Asymmetric hem with tassel ties — a warm-weather staple.',
    price_range: '$118',
    tags: ['paisley', 'wrap', 'saffron', 'tassel', 'asymmetric'],
  },
  {
    title: 'Coastal Breeze Linen Jumpsuit',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/coastal-breeze-linen-jumpsuit',
    image_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80',
    market: 'Missy',
    category: 'Dresses',
    description: 'Relaxed wide-leg linen jumpsuit with a V-neck and adjustable waist tie. In natural flax and dusty rose.',
    price_range: '$168',
    tags: ['linen', 'jumpsuit', 'wide-leg', 'natural', 'relaxed'],
  },
  {
    title: 'Beaded Medallion Statement Earrings',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/beaded-medallion-earrings',
    image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&q=80',
    market: 'Juniors',
    category: 'Accessories',
    description: 'Oversized beaded medallion earrings with turquoise and coral accents. Boho-luxe statement jewelry.',
    price_range: '$48',
    tags: ['beaded', 'statement', 'turquoise', 'earrings', 'boho-luxe'],
  },
  // ─── ALTAR'D STATE ───
  {
    title: 'Celestie Maxi Dress',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/celestie-maxi-dress',
    image_url: 'https://images.unsplash.com/photo-1518622358385-8ea7d0794bf6?w=600&q=80',
    market: 'Juniors',
    category: 'Dresses',
    description: 'Ethereal maxi dress with smocked bodice and flutter sleeves. Watercolor floral in soft pinks and lavender.',
    price_range: '$89.95',
    tags: ['maxi', 'smocked', 'floral', 'watercolor', 'ethereal'],
  },
  {
    title: 'Meadow Walk Crochet Cardigan',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/meadow-walk-crochet-cardigan',
    image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cda3a04?w=600&q=80',
    market: 'Juniors',
    category: 'Outerwear',
    description: 'Open-front crochet cardigan in cream with colorful granny-square panels. Perfect layering piece for festival season.',
    price_range: '$69.95',
    tags: ['crochet', 'cardigan', 'granny-square', 'festival', 'colorful'],
  },
  {
    title: 'Desert Rose Embroidered Shorts',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/desert-rose-shorts',
    image_url: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&q=80',
    market: 'Juniors',
    category: 'Bottoms',
    description: 'High-waisted denim shorts with rose embroidery along the hem. Vintage wash with raw edges.',
    price_range: '$54.95',
    tags: ['embroidered', 'denim', 'shorts', 'vintage', 'rose'],
  },
  {
    title: 'Harmony Smocked Off-Shoulder Top',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/harmony-smocked-top',
    image_url: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=600&q=80',
    market: 'Juniors',
    category: 'Tops',
    description: 'Smocked off-shoulder top with balloon sleeves and a cropped hem. Ditsy floral in dusty blue and ivory.',
    price_range: '$44.95',
    tags: ['smocked', 'off-shoulder', 'balloon-sleeve', 'floral', 'crop'],
  },
  {
    title: 'Willow Branch Tiered Maxi Skirt',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/willow-branch-maxi-skirt',
    image_url: 'https://images.unsplash.com/photo-1577900232427-18219b9166a0?w=600&q=80',
    market: 'Missy',
    category: 'Bottoms',
    description: 'Flowing tiered maxi skirt in a botanical print. Elastic waist with a boho-luxe drape in olive and cream.',
    price_range: '$74.95',
    tags: ['tiered', 'maxi', 'botanical', 'olive', 'boho-luxe'],
  },
  {
    title: 'Gypsy Spirit Wrap Blouse',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/gypsy-spirit-wrap-blouse',
    image_url: 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600&q=80',
    market: 'Missy',
    category: 'Tops',
    description: 'Breezy wrap blouse with ruffled edges and tie closure. Romantic block-print in terracotta and white.',
    price_range: '$59.95',
    tags: ['wrap', 'ruffled', 'block-print', 'romantic', 'terracotta'],
  },
  // ─── GIRLS MARKET ───
  {
    title: 'Mini Dreamer Floral Romper',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/mini-dreamer-romper',
    image_url: 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?w=600&q=80',
    market: 'Girls',
    category: 'Dresses',
    description: 'Girls\' floral romper with ruffled straps and elastic waist. Soft cotton in a vintage-inspired wildflower print.',
    price_range: '$58',
    tags: ['romper', 'floral', 'ruffled', 'girls', 'cotton'],
  },
  {
    title: 'Little Wanderer Crochet Vest',
    brand: "Altar'd State",
    source_url: 'https://www.altardstate.com/shop/little-wanderer-vest',
    image_url: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&q=80',
    market: 'Girls',
    category: 'Outerwear',
    description: 'Girls\' open-front crochet vest with fringe trim. Boho layering in cream — pairs with everything.',
    price_range: '$39.95',
    tags: ['crochet', 'vest', 'fringe', 'girls', 'layering'],
  },
  {
    title: 'Sunshine Daisy Tiered Dress',
    brand: 'Anthropologie',
    source_url: 'https://www.anthropologie.com/shop/sunshine-daisy-dress',
    image_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80',
    market: 'Girls',
    category: 'Dresses',
    description: 'Girls\' tiered sundress with daisy embroidery and tie-back detail. Soft chambray with a whimsical boho feel.',
    price_range: '$68',
    tags: ['tiered', 'embroidered', 'daisy', 'girls', 'chambray'],
  },
  {
    title: 'Blossom Trail Printed Palazzo Pants',
    brand: 'Free People',
    source_url: 'https://www.freepeople.com/shop/blossom-trail-palazzo',
    image_url: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=600&q=80',
    market: 'Girls',
    category: 'Bottoms',
    description: 'Girls\' wide-leg palazzo pants in a bohemian patchwork print. Elastic waist for comfort, flowy silhouette for style.',
    price_range: '$48',
    tags: ['palazzo', 'patchwork', 'wide-leg', 'girls', 'bohemian'],
  },
  // ─── PINTEREST INSPIRATION ───
  {
    title: 'Earth-Tone Layered Boho Look',
    brand: 'Pinterest',
    source_url: 'https://www.pinterest.com/search/pins/?q=bohemian+fashion+2026',
    image_url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&q=80',
    market: 'Missy',
    category: 'Styling',
    description: 'Trending: Layered earth-tone outfits combining linen, crochet, and raw textures. Neutrals with pops of terracotta and sage.',
    price_range: '',
    tags: ['earth-tone', 'layered', 'trending', 'linen', 'styling'],
  },
  {
    title: 'Festival Boho — Crochet & Fringe',
    brand: 'Pinterest',
    source_url: 'https://www.pinterest.com/search/pins/?q=boho+festival+outfit',
    image_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80',
    market: 'Juniors',
    category: 'Styling',
    description: 'Festival-ready boho looks trending on Pinterest: crochet tops, fringe bags, layered jewelry, and wide-leg pants.',
    price_range: '',
    tags: ['festival', 'crochet', 'fringe', 'trending', 'styling'],
  },
  {
    title: 'Cottagecore Meets Boho — Prairie Dresses',
    brand: 'Pinterest',
    source_url: 'https://www.pinterest.com/search/pins/?q=cottagecore+boho+dress',
    image_url: 'https://images.unsplash.com/photo-1502716119720-b23a1e3f2b23?w=600&q=80',
    market: 'Missy',
    category: 'Styling',
    description: 'The cottagecore-boho crossover continues: prairie dresses with embroidery, puff sleeves, and wildflower prints dominate Spring 2026.',
    price_range: '',
    tags: ['cottagecore', 'prairie', 'embroidery', 'trending', 'spring-2026'],
  },
];

async function seed() {
  console.log('Seeding Jazzy trends...');

  // Ensure table exists
  await pool.query(`CREATE TABLE IF NOT EXISTS jazzy_trends (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    brand TEXT,
    source_url TEXT,
    image_url TEXT,
    market TEXT,
    category TEXT,
    description TEXT,
    price_range TEXT,
    tags TEXT[],
    found_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // Clear existing seed data
  await pool.query('DELETE FROM jazzy_trends');

  let count = 0;
  for (const t of trends) {
    await pool.query(
      `INSERT INTO jazzy_trends (title, brand, source_url, image_url, market, category, description, price_range, tags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [t.title, t.brand, t.source_url, t.image_url, t.market, t.category, t.description, t.price_range, t.tags]
    );
    count++;
  }

  console.log(`Seeded ${count} trends.`);
  await pool.end();
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
