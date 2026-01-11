export async function onRequestGet(context: any) {
  const { env, request } = context;
  const url = new URL(request.url);
  const testUserId = url.searchParams.get('test_user');
  
  const now = Date.now();
  // 【测试模式】2 分钟（120,000ms）未签到即视为失联
  const ALERT_THRESHOLD = 2 * 60 * 1000; 
  const RESEND_API_KEY = env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ 
      status: "error", 
      message: "未配置 RESEND_API_KEY" 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ 
      status: "error", 
      message: "数据库未绑定" 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    let usersToAlert = [];

    if (testUserId) {
      const { results } = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(testUserId).all();
      usersToAlert = results.map(r => ({ ...r, daysMissed: '模拟' }));
    } else {
      // 查找超过 2 分钟未签到的活跃用户
      const { results } = await env.DB.prepare(`
        SELECT 
          u.id as user_id,
          u.name as user_name, 
          u.last_check_in, 
          u.language,
          c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 
        AND u.last_check_in < ?
        ORDER BY u.last_check_in DESC
        LIMIT 5
      `).bind(now - ALERT_THRESHOLD).all();
      
      usersToAlert = results || [];
    }

    const report = [];

    for (const user of usersToAlert) {
      const daysMissed = typeof user.daysMissed === 'string' ? user.daysMissed : Math.floor((now - user.last_check_in) / (60 * 1000));
      const isEn = user.language === 'en';
      const subject = isEn ? `[Test Alert] Safety check for ${user.user_name}` : `【测试预警】请立即确认${user.user_name}的安全状态`;
      const textBody = isEn 
        ? `TEST: ${user.user_name} (ID: ${user.user_id}) missed check-in.` 
        : `【测试预警】您的关联人 ${user.user_name} (ID: ${user.user_id}) 已连续 ${daysMissed} 分钟未签到。`;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Live Well Test <onboarding@resend.dev>",
          to: [user.contact_email],
          subject: subject,
          text: textBody,
        }),
      });

      const resendData: any = await resendResponse.json();

      report.push({
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.contact_email,
        success: resendResponse.ok,
        debug: resendData
      });
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      found_count: usersToAlert.length,
      report 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ status: "error", message: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}
