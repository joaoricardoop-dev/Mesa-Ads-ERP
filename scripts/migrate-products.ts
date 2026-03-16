import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        "unitLabel" VARCHAR(50) NOT NULL DEFAULT 'unidade',
        "unitLabelPlural" VARCHAR(50) NOT NULL DEFAULT 'unidades',
        "defaultQtyPerLocation" INTEGER DEFAULT 500,
        irpj DECIMAL(5,2) DEFAULT 6.00,
        "comRestaurante" DECIMAL(5,2) DEFAULT 15.00,
        "comComercial" DECIMAL(5,2) DEFAULT 10.00,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS product_pricing_tiers (
        id SERIAL PRIMARY KEY,
        "productId" INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        "volumeMin" INTEGER NOT NULL,
        "volumeMax" INTEGER,
        "custoUnitario" DECIMAL(10,4) NOT NULL,
        frete DECIMAL(10,2) NOT NULL,
        margem DECIMAL(5,2) NOT NULL DEFAULT 50.00,
        artes INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_product_pricing_tiers_product_id ON product_pricing_tiers("productId");
    `);

    const existing = await client.query("SELECT id FROM products WHERE name = 'Bolacha de Chopp'");
    if (existing.rows.length === 0) {
      const res = await client.query(`
        INSERT INTO products (name, description, "unitLabel", "unitLabelPlural", "defaultQtyPerLocation", irpj, "comRestaurante", "comComercial")
        VALUES ('Bolacha de Chopp', 'Porta-copos publicitários para bares e restaurantes', 'bolacha', 'bolachas', 500, 6.00, 15.00, 10.00)
        RETURNING id
      `);
      const productId = res.rows[0].id;

      const tiers = [
        [1000, 1999, 0.4190, 80.38, 50, 1],
        [2000, 2999, 0.3495, 138.16, 50, 1],
        [3000, 3999, 0.3330, 219.03, 50, 1],
        [4000, 4999, 0.3248, 299.41, 50, 1],
        [5000, 5999, 0.2998, 357.19, 50, 1],
        [6000, 6999, 0.2998, 438.06, 50, 1],
        [7000, 7999, 0.2998, 518.44, 50, 1],
        [8000, 8999, 0.2998, 576.22, 50, 1],
        [9000, 9999, 0.2998, 657.09, 50, 1],
        [10000, 10999, 0.2700, 737.47, 50, 1],
        [11000, 11999, 0.2700, 876.12, 50, 1],
        [12000, 12999, 0.2700, 956.50, 50, 1],
        [13000, 13999, 0.2700, 1094.66, 50, 1],
        [14000, 14999, 0.2700, 1175.53, 50, 1],
        [15000, 15999, 0.2700, 1255.91, 50, 1],
        [16000, 16999, 0.2700, 1313.69, 50, 1],
        [17000, 17999, 0.2700, 1394.56, 50, 1],
        [18000, 18999, 0.2700, 1474.94, 50, 1],
        [19000, 19999, 0.2700, 1532.72, 50, 1],
        [20000, null, 0.2600, 1613.59, 50, 1],
      ];

      for (const [vMin, vMax, custo, frete, margem, artes] of tiers) {
        await client.query(
          'INSERT INTO product_pricing_tiers ("productId", "volumeMin", "volumeMax", "custoUnitario", frete, margem, artes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [productId, vMin, vMax, custo, frete, margem, artes]
        );
      }
      console.log("Seeded Bolacha de Chopp product with 20 pricing tiers (id=" + productId + ")");
    } else {
      console.log("Bolacha de Chopp already exists (id=" + existing.rows[0].id + "), skipping seed");
    }

    console.log("Products migration complete");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
