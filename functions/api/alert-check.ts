export async function onRequestGet(context: any) {
  const { env, request } = context;
  const url = new URL(request.url);
  // 获取指定的 user_id 参数
  const targetUserId = url.searchParams.get('user_id');
  
  const now = Date.now();
  const ALERT_THRESHOLD = 2 * 60 * 1000; // 2分钟失联阈值
  const RESEND_API_KEY = env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ status: "error", message: "未配置 RESEND_API_KEY" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ status: "error", message: "数据库未绑定" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    let usersToAlert = [];

    if (targetUserId) {
      // 模式 A: 仅针对当前指定用户进行安全检查（无论是否失联，方便测试）
      const { results } = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.language, c.email as contact_email, u.last_check_in
        FROM users u
        LEFT JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(targetUserId).all();
      usersToAlert = results || [];
    } else {
      // 模式 B: 巡检全库中失联的用户
      const { results } = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.last_check_in, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 AND u.last_check_in < ?
        ORDER BY u.last_check_in DESC LIMIT 5
      `).bind(now - ALERT_THRESHOLD).all();
      usersToAlert = results || [];
    }

    const report = [];

    for (const user of usersToAlert) {
      if (!user.contact_email) {
        report.push({ user_id: user.user_id, success: false, message: "该用户未配置紧急联系人邮箱" });
        continue;
      }

      const isEn = user.language === 'en';
      const subject = isEn ? `[Safety Test] ${user.user_name}` : `【安全测试】请确认${user.user_name}的状态`;
      const textBody = `这不仅是一次测试。用户 ID: ${user.user_id} 当前在云端数据库中绑定的邮箱是: ${user.contact_email}`;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Live Well <onboarding@resend.dev>",
          to: [user.contact_email],
          subject: subject,
          text: textBody,
        }),
      });

      const resendData: any = await resendResponse.json();
      report.push({
        user_id: user.user_id,
        user_name: user.user_name,
        cloud_email: user.contact_email, // 显式展示数据库里的邮箱
        success: resendResponse.ok,
        debug: resendData
      });
    }

    return new Response(JSON.stringify({ 
      status: "success", 
      mode: targetUserId ? "Targeted" : "Scan",
      report 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
