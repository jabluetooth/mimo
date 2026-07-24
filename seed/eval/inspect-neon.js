const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.NEON_URL });
  await client.connect();

  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
  );
  console.log("Tables:", tables.rows.map((r) => r.table_name));

  const cols = await client.query(
    "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='query_logs' ORDER BY ordinal_position;"
  );
  console.log("\nquery_logs columns:");
  for (const c of cols.rows) console.log(" -", c.column_name, c.data_type, c.column_default || "");

  const count = await client.query("SELECT count(*) FROM query_logs;");
  console.log("\nRow count:", count.rows[0].count);

  const sample = await client.query("SELECT * FROM query_logs ORDER BY 1 DESC LIMIT 5;");
  console.log("\nSample rows:");
  console.log(JSON.stringify(sample.rows, null, 2));

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
