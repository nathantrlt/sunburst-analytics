const mysql = require('mysql2/promise');

async function checkDepth() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'interchange.proxy.rlwy.net',
      port: 19334,
      user: 'root',
      password: 'QErSbonXDXnqdrxnUvvtJUnjGBHhYlMK',
      database: 'railway'
    });

    console.log('Verification des profondeurs calculees :\n');

    const [rows] = await connection.query(`
      SELECT
        page_url,
        page_title,
        COUNT(*) as total_views,
        AVG(sequence_number) as avg_position_raw,
        ROUND(AVG(sequence_number)) as avg_position_rounded,
        MIN(sequence_number) as min_seq,
        MAX(sequence_number) as max_seq
      FROM pageviews
      GROUP BY page_url, page_title
      ORDER BY total_views DESC
      LIMIT 10
    `);

    rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.page_title || row.page_url.substring(0, 50)}`);
      console.log(`   Vues: ${row.total_views}`);
      console.log(`   Profondeur moyenne (brute): ${row.avg_position_raw}`);
      console.log(`   Profondeur moyenne (arrondie): ${row.avg_position_rounded}`);
      console.log(`   Plage: ${row.min_seq} - ${row.max_seq}`);
      console.log('');
    });

    console.log('\nExemples de sessions individuelles:\n');
    const [sessions] = await connection.query(`
      SELECT session_id, page_url, page_title, sequence_number
      FROM pageviews
      ORDER BY session_id, sequence_number
      LIMIT 20
    `);

    let currentSession = null;
    sessions.forEach(s => {
      if (s.session_id !== currentSession) {
        console.log(`\nSession: ${s.session_id}`);
        currentSession = s.session_id;
      }
      console.log(`  ${s.sequence_number}. ${s.page_title || s.page_url.substring(0, 40)}`);
    });

  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkDepth();
