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
      message: "Cloudflare 环境变量未配置 RESEND_API_KEY，请在 Pages 设置中添加并重新部署。" 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ 
      status: "error", 
      message: "数据库未绑定，请在 Cloudflare 控制台的 Pages 设置 -> Functions 中绑定 D1 数据库，Variable Name 必须为 DB。" 
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    let usersToAlert = [];

    if (testUserId) {
      const { results } = await env.DB.prepare(`
        SELECT u.name as user_name, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(testUserId).all();
      usersToAlert = results.map(r => ({ ...r, daysMissed: '2 (模拟)' }));
    } else {
      // 查找超过 2 分钟未签到的用户
      const { results } = await env.DB.prepare(`
        SELECT 
          u.name as user_name, 
          u.last_check_in, 
          u.language,
          c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 
        AND u.last_check_in < ?
      `).bind(now - ALERT_THRESHOLD).all();
      
      usersToAlert = results || [];
    }

    const report = [];

    for (const user of usersToAlert) {
      const daysMissed = typeof user.daysMissed === 'string' ? user.daysMissed : Math.floor((now - user.last_check_in) / (60 * 1000));
      const isEn = user.language === 'en';
      const subject = isEn ? `[Test Alert] Safety check for ${user.user_name}` : `【测试预警】请立即确认${user.user_name}的安全状态`;
      const textBody = isEn 
        ? `TEST MODE: ${user.user_name} has missed check-ins for ${daysMissed} minutes (simulated days). Please verify their safety.` 
        : `尊敬的紧急联系人：\n\n您好！这是来自【活着么】App的测试预警。\n\n您的关联人 ${user.user_name} 已连续 ${daysMissed} 分钟（测试模式模拟 ${daysMissed} 天）未完成签到。请尽快尝试联系 TA 以确认安全。\n\n——来自【活着么】自动化测试系统`;

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
        user: user.user_name,
        email: user.contact_email,
        success: resendResponse.ok,
        debug: resendResponse.ok ? "Sent" : resendData
      });
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      server_time: new Date(now).toISOString(),
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
