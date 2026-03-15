const pool = require('./config/database');

async function test() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const sender_id = 14; 
    const receiver_id = 15;
    
    // Test acceptBySender query
    const requestResult = await client.query(
      `SELECT * FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [sender_id, receiver_id]
    );

    console.log('Pending requests:', requestResult.rows);

    if (requestResult.rows.length > 0) {
      const min = Math.min(sender_id, receiver_id);
      const max = Math.max(sender_id, receiver_id);

      await client.query('INSERT INTO friendships (user1_id, user2_id) VALUES ($1, $2)', [min, max]);
      console.log('Inserted friendship!');
      
      const res = await client.query('SELECT * FROM friendships');
      console.log('Friendships:', res.rows);
    }
    await client.query('ROLLBACK'); 
  } catch(e) { 
    console.error('Error:', e); 
    await client.query('ROLLBACK');
  } finally { 
    if (client) client.release();
    process.exit(); 
  }
}
test();
