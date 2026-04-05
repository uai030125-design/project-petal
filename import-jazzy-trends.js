#!/usr/bin/env node
// Quick one-time import of 5 scouted boho trends into jazzy_trends table
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://localhost:5432/unlimited_avenues' });

const trends = [
  {
    title: "Bohemian Minimalism Crochet Top",
    brand: "Free People",
    source_url: "https://www.freepeople.com/new-clothes/",
    image_url: "",
    market: "Missy",
    category: "Tops",
    description: "Refined slim-fit crochet top in natural cotton thread. The 2026 evolution replaces multicolor festival crochet with clean, intentional artisanal details.",
    price_range: "$68-$98",
    tags: ["boho", "crochet", "minimalist", "spring", "artisanal"]
  },
  {
    title: "Flowing Linen Maxi Dress",
    brand: "Anthropologie",
    source_url: "https://www.anthropologie.com/new-dresses",
    image_url: "",
    market: "Missy",
    category: "Dresses",
    description: "Clean A-line maxi dress in sun-washed linen with subtle movement. Fluid and intentional in soft terracotta, sage green, and dusty blue tones.",
    price_range: "$128-$178",
    tags: ["boho", "maxi", "linen", "spring", "earth-tones"]
  },
  {
    title: "Fringed Suede Cropped Jacket",
    brand: "Free People",
    source_url: "https://www.freepeople.com/catalog-products/",
    image_url: "",
    market: "Juniors",
    category: "Outerwear",
    description: "Shrunken cropped suede jacket with fringe detailing, landing right at the hip. A key transitional piece for spring layering.",
    price_range: "$148-$228",
    tags: ["boho", "suede", "fringe", "jacket", "western"]
  },
  {
    title: "High-Rise Boho Flare Jeans",
    brand: "Anthropologie Pilcro",
    source_url: "https://www.anthropologie.com/new-clothes",
    image_url: "",
    market: "Juniors",
    category: "Bottoms",
    description: "High-rise flared jeans from Pilcro denim. Free-spirited flares are the must-have bottom for 2026, pair with sheer blouses for full boho impact.",
    price_range: "$88-$138",
    tags: ["boho", "flare", "denim", "high-rise", "pilcro"]
  },
  {
    title: "Romantic Lace Spring Mini",
    brand: "Altar'd State",
    source_url: "https://www.altardstate.com/as/seasonal/spring-outfits/",
    image_url: "",
    market: "Girls",
    category: "Dresses",
    description: "Romantic lace mini dress in blush pink with gentle florals. Soft neutrals, delicate textures, and sun-washed hues that feel timeless.",
    price_range: "$59-$89",
    tags: ["boho", "lace", "floral", "mini-dress", "romantic"]
  }
];

(async () => {
  try {
    // Create table if needed
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

    let imported = 0;
    for (const t of trends) {
      await pool.query(
        `INSERT INTO jazzy_trends (title, brand, source_url, image_url, market, category, description, price_range, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.title, t.brand, t.source_url, t.image_url, t.market, t.category, t.description, t.price_range, t.tags]
      );
      imported++;
    }
    console.log(`✅ Imported ${imported} trends into jazzy_trends table`);

    // Show what's in the table
    const result = await pool.query('SELECT id, title, brand, market, category FROM jazzy_trends ORDER BY id DESC LIMIT 10');
    console.table(result.rows);
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
})();
