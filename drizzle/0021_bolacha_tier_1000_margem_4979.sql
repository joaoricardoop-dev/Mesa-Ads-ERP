UPDATE product_pricing_tiers
SET margem = '49.79'
WHERE "productId" = (
  SELECT id FROM products WHERE name = 'Bolacha de Chopp' LIMIT 1
)
AND "volumeMin" = 1000
AND margem = '50.00';
