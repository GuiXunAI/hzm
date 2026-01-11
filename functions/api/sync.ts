
export async function onRequestPost(context: any) {
  const { request, env } = context;
  const data = await request.json();

  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not bound" }), { status: 500 });
  }

  try {
    // 1. 同步用户基础信息
    await env.DB.prepare(`
      INSERT INTO users (id, name, email, last_check_in, streak, language, is_registered)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, email=excluded.email, last_check_in=excluded.last_check_in, 
      streak=excluded.streak, language=excluded.language, is_registered=excluded.is_registered,
      updated_at=CURRENT_TIMESTAMP
    `).bind(
      data.userId, 
      data.userContact.name, 
      data.userContact.email, 
      data.lastCheckIn, 
      data.streak,
      data.language,
      data.isRegistered ? 1 : 0
    ).run();

    // 2. 同步最新的签到历史 (增量更新)
    if (data.checkInHistory && data.checkInHistory.length > 0) {
      const lastItem = data.checkInHistory[data.checkInHistory.length - 1];
      await env.DB.prepare(`
        INSERT INTO check_ins (user_id, timestamp, date_string, time_string)
        SELECT ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM check_ins WHERE user_id = ? AND date_string = ?)
      `).bind(
        data.userId,
        lastItem.timestamp,
        lastItem.dateString,
        lastItem.timeString,
        data.userId,
        lastItem.dateString
      ).run();
    }

    // 3. 同步联系人
    await env.DB.prepare("DELETE FROM contacts WHERE user_id = ?").bind(data.userId).run();
    for (const c of data.emergencyContacts) {
      if (c.email) {
        await env.DB.prepare("INSERT INTO contacts (id, user_id, name, email, phone) VALUES (?, ?, ?, ?, ?)")
          .bind(c.id, data.userId, c.name, c.email, c.phone).run();
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
