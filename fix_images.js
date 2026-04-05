const http = require('http');

// Real product images scraped from retailer sites
const REAL_IMAGES = {
  // ASOS - confirmed og:image URLs
  46: 'https://images.asos-media.com/products/reclaimed-vintage-limited-edition-long-sleeve-multicolor-festival-crochet-mini-dress/204140039-1-multi',
  45: 'https://images.asos-media.com/products/miss-selfridge-crochet-tie-front-boho-cardigan-in-cream/208518735-1-cream',
  42: 'https://images.asos-media.com/products/yas-festival-boho-style-crochet-trim-cami-midi-dress-in-cream/208288494-1-birch',
  39: 'https://images.asos-media.com/products/miss-selfridge-crochet-tassel-boho-jumper-in-cream/209039259-1-cream',
  37: 'https://images.asos-media.com/products/yas-festival-crochet-lace-insert-boho-maxi-skirt-in-cream/208524328-1-birch',
  // Free People - urbndata URLs already in DB
  26: 'https://images.urbndata.com/is/image/FreePeople/103179669_060_g',
  31: 'https://images.urbndata.com/is/image/FreePeople/103179669_060_g',
  28: 'https://images.urbndata.com/is/image/FreePeople/104689542_036_p',
  33: 'https://images.urbndata.com/is/image/FreePeople/104689542_036_p',
};

// Best-matching Unsplash photos for fictional product URLs (ids 1-22, 27, 29-30, 32, 34-36, 38, 40-41, 43-44)
const UNSPLASH = {
  1:  'photo-1596783074918-c84cb06531ca',  // Folk Town Boho Maxi Dress → pink maxi dress
  2:  'photo-1586569472133-cfdaef59a1b2',  // Daydreamer Crochet Top → crochet top
  3:  'photo-1509631179647-0177331693ae',  // Canyon Sunset Wide-Leg Pants → wide pants
  4:  'photo-1572804013309-59a88b7e92f1',  // Wildflower Tiered Mini Dress → floral mini
  5:  'photo-1585003489790-29594757d64e',  // Wanderer Suede Fringe Jacket → suede jacket
  6:  'photo-1520001511854-28b997879446',  // Luna Lace Bell-Sleeve Top → floral top
  7:  'photo-1600075108097-f64b1fc12a41',  // Embroidered Prairie Midi Dress → prairie dress
  8:  'photo-1548883354-d056ab7b441f',     // Artisan Patchwork Quilted Vest → vest/jacket
  9:  'photo-1590874103328-eac38a683ce7',  // Woven Rattan Crossbody Bag → handbag
  10: 'photo-1595777457583-95e059d581b8',  // Saffron Paisley Wrap Skirt → red flowing
  11: 'photo-1594633312681-425c7b97ccd1',  // Coastal Breeze Linen Jumpsuit → jumpsuit
  12: 'photo-1535632066927-ab7c9ab60908',  // Beaded Medallion Statement Earrings → earrings
  13: 'photo-1583333001978-8c57d752ce5b',  // Celestie Maxi Dress → beige dress
  14: 'photo-1603321581635-d46915755425',  // Meadow Walk Crochet Cardigan → crochet sweater
  15: 'photo-1515886657613-9f3515b0c78f',  // Desert Rose Embroidered Shorts → model outfit
  16: 'photo-1551803091-e20673f15770',     // Harmony Smocked Off-Shoulder Top → top
  17: 'photo-1597532842922-dd855db3e562',  // Willow Branch Tiered Maxi Skirt → sundress/skirt
  18: 'photo-1485968579580-b6d095142e6e',  // Gypsy Spirit Wrap Blouse → dark fashion
  19: 'photo-1589210015183-d955279bfa6e',  // Mini Dreamer Floral Romper → pink floral
  20: 'photo-1607885560883-56dc5bb98728',  // Little Wanderer Crochet Vest → crochet texture
  21: 'photo-1583496661160-fb5886a0aaaa',  // Sunshine Daisy Tiered Dress → knit/dress
  22: 'photo-1469334031218-e382a71b716b',  // Blossom Trail Palazzo Pants → fashion
  23: 'photo-1682003452663-80189542a38a',  // Earth-Tone Layered Boho Look → boho casual
  24: 'photo-1621184455862-c163dfb30e0f',  // Festival Boho Crochet & Fringe → boho festival
  25: 'photo-1600075108097-f64b1fc12a41',  // Cottagecore Prairie Dresses → prairie dress
  27: 'photo-1507005941618-1ca013b9a018',  // Flowing Linen Maxi Dress → white lace dress
  29: 'photo-1475178626620-a4d074967452',  // High-Rise Boho Flare Jeans → jeans
  30: 'photo-1551803091-e20673f15770',     // Romantic Lace Spring Mini → lace dress
  32: 'photo-1583333001978-8c57d752ce5b',  // Flowing Linen Maxi Dress → beige dress
  34: 'photo-1475178626620-a4d074967452',  // High-Rise Boho Flare Jeans → jeans
  35: 'photo-1589210015183-d955279bfa6e',  // Romantic Lace Spring Mini → pink floral
  36: 'photo-1586569472133-cfdaef59a1b2',  // Lily Crochet Top (Revolve) → crochet top
  38: 'photo-1524504388940-b1c1722653e1',  // Kimchi Blue Crochet Halter Top (UO) → outfit
  40: 'photo-1596783074918-c84cb06531ca',  // Elliatt Tilly Tiered Maxi Dress → pink maxi
  41: 'photo-1572804013309-59a88b7e92f1',  // Floral Tiered Maxi Dress → floral mini
  43: 'photo-1525507119028-ed4c629a60a3',  // Kimchi Blue Crochet Cardigan (UO) → jacket
  44: 'photo-1621184455862-c163dfb30e0f',  // Crochet Beach Cover-Up (UO) → boho festival
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => { try { resolve(JSON.parse(out)); } catch { resolve(out); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const trends = await httpGet('http://localhost:4000/api/debug-trends-full');
  console.log('Found', trends.length, 'trends\n');

  const updates = [];
  for (const t of trends) {
    let newUrl;
    if (REAL_IMAGES[t.id]) {
      newUrl = REAL_IMAGES[t.id];
      console.log(`  [${t.id}] REAL: "${t.title.substring(0,40)}" → ${newUrl.substring(0,60)}...`);
    } else if (UNSPLASH[t.id]) {
      newUrl = 'https://images.unsplash.com/' + UNSPLASH[t.id] + '?w=400';
      console.log(`  [${t.id}] STOCK: "${t.title.substring(0,40)}" → ...${UNSPLASH[t.id].slice(-12)}`);
    } else {
      console.log(`  [${t.id}] SKIP: "${t.title.substring(0,40)}"`);
      continue;
    }

    if (newUrl !== t.image_url) {
      updates.push({ id: t.id, image_url: newUrl });
    }
  }

  console.log(`\nUpdating ${updates.length} images...`);
  if (updates.length > 0) {
    const result = await httpPost('http://localhost:4000/api/debug-fix-images', updates);
    console.log('Result:', result);
  }
}

main().catch(console.error);
